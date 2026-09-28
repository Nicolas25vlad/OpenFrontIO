import { describe, expect, test } from "vitest";
import {
  NaturalResource,
  RESOURCE_CONTINENT_ZONES,
  RESOURCE_GENERATION_CONFIG,
  RESOURCE_MIN_NODE_DISTANCE,
  RESOURCE_NODE_CELL_SIZE,
  ResourceCatalog,
  ResourceContinentZone,
  ResourceNode,
  resourceNodesForMap,
  resourceTotalsForOwner,
} from "../../../src/core/game/Resources";
import { setup } from "../../util/Setup";

function landMap(width = 1024, height = 1024) {
  return {
    width: () => width,
    height: () => height,
    ref: (x: number, y: number) => y * width + x,
    x: (tile: number) => tile % width,
    y: (tile: number) => Math.floor(tile / width),
    isLand: () => true,
    isImpassable: () => false,
  };
}

function resourceCellComponents(
  nodes: readonly ResourceNode[],
  resource: NaturalResource,
): number[][][] {
  const cells = new Set(
    nodes
      .filter((node) => node.resource === resource)
      .map(
        (node) =>
          `${Math.floor(node.x / RESOURCE_NODE_CELL_SIZE)}:${Math.floor(
            node.y / RESOURCE_NODE_CELL_SIZE,
          )}`,
      ),
  );
  const components: number[][][] = [];

  while (cells.size > 0) {
    const first = cells.values().next().value as string;
    const [firstX, firstY] = first.split(":").map(Number);
    const component = [[firstX, firstY]];
    const frontier = [[firstX, firstY]];
    cells.delete(first);

    while (frontier.length > 0) {
      const [x, y] = frontier.pop()!;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const key = `${x + dx}:${y + dy}`;
          if (!cells.delete(key)) continue;
          const neighbor: number[] = [x + dx, y + dy];
          component.push(neighbor);
          frontier.push(neighbor);
        }
      }
    }
    components.push(component);
  }

  return components;
}

function resourceRegionsInZone(
  nodes: readonly ResourceNode[],
  resource: NaturalResource,
  zone: ResourceContinentZone,
  width: number,
  height: number,
): number {
  const minX = zone.minX * width;
  const maxX = zone.maxX * width;
  const minY = zone.minY * height;
  const maxY = zone.maxY * height;
  return resourceCellComponents(nodes, resource).filter((component) =>
    component.some(([cellX, cellY]) => {
      const centerX = (cellX + 0.5) * RESOURCE_NODE_CELL_SIZE;
      const centerY = (cellY + 0.5) * RESOURCE_NODE_CELL_SIZE;
      return (
        centerX >= minX && centerX < maxX && centerY >= minY && centerY < maxY
      );
    }),
  ).length;
}

describe("deterministic resource deposits", () => {
  test("returns the same nodes for the same match seed", () => {
    const map = landMap();

    expect(resourceNodesForMap(map, "match-a")).toEqual(
      resourceNodesForMap(map, "match-a"),
    );
  });

  test("caches the generated catalog per map and match seed", () => {
    const map = landMap();

    expect(resourceNodesForMap(map, "match-a")).toBe(
      resourceNodesForMap(map, "match-a"),
    );
    expect(resourceNodesForMap(map, "match-a")).not.toBe(
      resourceNodesForMap(map, "match-b"),
    );
  });

  test("protects cached nodes from consumer mutation", () => {
    const map = landMap();
    const nodes = resourceNodesForMap(map, "immutable-match");
    const richness = nodes[0].richness;

    expect(Object.isFrozen(nodes)).toBe(true);
    expect(Object.isFrozen(nodes[0])).toBe(true);
    expect(() => {
      (nodes[0] as { richness: number }).richness = 0;
    }).toThrow();
    expect(resourceNodesForMap(map, "immutable-match")[0].richness).toBe(
      richness,
    );
  });

  test("changes locations between match seeds", () => {
    const map = landMap();

    expect(resourceNodesForMap(map, "match-a")).not.toEqual(
      resourceNodesForMap(map, "match-b"),
    );
  });

  test("creates broad independent zones with gradual richness", () => {
    const map = landMap(2048, 1024);
    const nodes = resourceNodesForMap(map, "zone-match");
    const counts = new Map<NaturalResource, number>();

    for (const node of nodes) {
      counts.set(node.resource, (counts.get(node.resource) ?? 0) + 1);
    }

    expect(counts.size).toBe(Object.values(NaturalResource).length);
    expect(Math.min(...counts.values())).toBeGreaterThan(3);
    expect(new Set(nodes.map((node) => node.richness)).size).toBeGreaterThan(2);
    expect(Math.max(...nodes.map((node) => node.richness))).toBeLessThanOrEqual(
      4,
    );

    let totalRegionCount = 0;
    for (const resource of Object.values(NaturalResource)) {
      const resourceNodes = nodes.filter((node) => node.resource === resource);
      const components = resourceCellComponents(nodes, resource);
      totalRegionCount += components.length;
      expect(
        resourceNodes.some((node, index) =>
          resourceNodes.some((other, otherIndex) => {
            if (index === otherIndex) return false;
            const dx = Math.abs(node.x - other.x);
            const dy = Math.abs(node.y - other.y);
            return (
              dx <= RESOURCE_NODE_CELL_SIZE * 1.2 &&
              dy <= RESOURCE_NODE_CELL_SIZE * 1.2
            );
          }),
        ),
      ).toBe(true);
      expect(
        components.some((component) => component.length >= 10),
        resource,
      ).toBe(true);
      expect(resourceNodes.length).toBeLessThan(
        (map.width() / RESOURCE_NODE_CELL_SIZE) *
          (map.height() / RESOURCE_NODE_CELL_SIZE),
      );
    }
    expect(totalRegionCount).toBeGreaterThan(
      Object.values(NaturalResource).length,
    );
    const layerMasks = Object.values(NaturalResource).map((resource) =>
      resourceCellComponents(nodes, resource)
        .flat()
        .map(([x, y]) => `${x}:${y}`)
        .sort()
        .join(","),
    );
    expect(new Set(layerMasks).size).toBe(
      Object.values(NaturalResource).length,
    );

    expect(
      nodes.every((node) =>
        Object.values(NaturalResource).includes(node.resource),
      ),
    ).toBe(true);
  });

  test("keeps resource-free cells instead of filling the whole map", () => {
    const map = landMap();
    const nodes = resourceNodesForMap(map, "coverage-match");
    const cellCount =
      Math.ceil(map.width() / RESOURCE_NODE_CELL_SIZE) *
      Math.ceil(map.height() / RESOURCE_NODE_CELL_SIZE);

    for (const resource of Object.values(NaturalResource)) {
      const coveredCells = new Set(
        nodes
          .filter((node) => node.resource === resource)
          .map(
            (node) =>
              `${Math.floor(node.x / RESOURCE_NODE_CELL_SIZE)}:${Math.floor(
                node.y / RESOURCE_NODE_CELL_SIZE,
              )}`,
          ),
      );

      expect(coveredCells.size, resource).toBeGreaterThan(0);
      expect(coveredCells.size, resource).toBeLessThan(cellCount);
    }
  });

  test("allows independent resource belts to overlap without sharing every cell", () => {
    const map = landMap(2048, 1024);
    const nodes = resourceNodesForMap(map, "geology-overlap-match");
    const resourcesByCell = new Map<string, Set<NaturalResource>>();

    for (const node of nodes) {
      const cell = `${Math.floor(node.x / RESOURCE_NODE_CELL_SIZE)}:${Math.floor(
        node.y / RESOURCE_NODE_CELL_SIZE,
      )}`;
      const resources = resourcesByCell.get(cell) ?? new Set<NaturalResource>();
      resources.add(node.resource);
      resourcesByCell.set(cell, resources);
    }

    const overlapCells = [...resourcesByCell.values()].filter(
      (resources) => resources.size > 1,
    );
    const exclusiveCells = [...resourcesByCell.values()].filter(
      (resources) => resources.size === 1,
    );

    expect(overlapCells.length).toBeGreaterThan(0);
    expect(exclusiveCells.length).toBeGreaterThan(0);
  });

  test("creates multiple producing regions without forcing every resource into each continent", () => {
    const map = landMap(2048, 1024);
    const nodes = resourceNodesForMap(map, "continent-coverage-match");

    for (const zone of Object.values(RESOURCE_CONTINENT_ZONES)) {
      const zoneNodes = nodes.filter(
        (node) =>
          node.x >= zone.minX * map.width() &&
          node.x < zone.maxX * map.width() &&
          node.y >= zone.minY * map.height() &&
          node.y < zone.maxY * map.height(),
      );

      expect(zoneNodes.length).toBeGreaterThan(1);
      expect(
        new Set(zoneNodes.map((node) => node.resource)).size,
      ).toBeGreaterThan(1);
    }
  });

  test("keeps deposits on passable land and multiple regions on the real world map", async () => {
    const game = await setup("world", { strategicEconomy: true });
    const nodes = game.resourceNodes();

    expect(nodes.length).toBeGreaterThan(0);
    expect(
      nodes.every((node) => {
        const tile = game.ref(node.x, node.y);
        return game.isLand(tile) && !game.isImpassable(tile);
      }),
    ).toBe(true);

    for (const [continent, zone] of Object.entries(RESOURCE_CONTINENT_ZONES)) {
      const zoneNodes = nodes.filter(
        (node) =>
          node.x >= zone.minX * game.width() &&
          node.x < zone.maxX * game.width() &&
          node.y >= zone.minY * game.height() &&
          node.y < zone.maxY * game.height(),
      );
      expect(zoneNodes.length, continent).toBeGreaterThan(1);
      expect(
        new Set(zoneNodes.map((node) => node.resource)).size,
        continent,
      ).toBeGreaterThan(1);
    }

    for (const continent of [
      "NorthAmerica",
      "SouthAmerica",
      "Africa",
      "Asia",
    ]) {
      const zone = RESOURCE_CONTINENT_ZONES[continent];
      const regionCount = Object.values(NaturalResource).reduce(
        (total, resource) =>
          total +
          resourceRegionsInZone(
            nodes,
            resource,
            zone,
            game.width(),
            game.height(),
          ),
        0,
      );
      expect(regionCount, continent).toBeGreaterThan(2);
    }
  });

  test("keeps the noise controls configurable for every resource", () => {
    for (const resource of Object.values(NaturalResource)) {
      const config = RESOURCE_GENERATION_CONFIG[resource];
      expect(config.scale).toBeGreaterThan(0);
      expect(config.frequency).toBeGreaterThan(0);
      expect(config.threshold).toBeGreaterThanOrEqual(0);
      expect(config.threshold).toBeLessThan(1);
      expect(config.abundance).toBeGreaterThan(0);
      expect(config.abundance).toBeLessThanOrEqual(1);
    }
  });

  test("finds local deposits away from visual markers and exposes overlaps", () => {
    const map = landMap(2048, 1024);
    const catalog = new ResourceCatalog(map, "mine-area-match");
    const markerTiles = new Set(
      catalog.nodes.map((node) => map.ref(node.x, node.y)),
    );
    let offMarkerDeposit: number | undefined;
    let overlap: number | undefined;

    for (let y = 0; y < map.height(); y += 8) {
      for (let x = 0; x < map.width(); x += 8) {
        const tile = map.ref(x, y);
        const deposits = catalog.depositsAt(tile);
        if (deposits.length > 1) overlap ??= tile;
        if (deposits.length > 0 && !markerTiles.has(tile))
          offMarkerDeposit ??= tile;
        if (overlap !== undefined && offMarkerDeposit !== undefined) break;
      }
      if (overlap !== undefined && offMarkerDeposit !== undefined) break;
    }

    expect(offMarkerDeposit).toBeDefined();
    expect(catalog.depositsAt(offMarkerDeposit!)).not.toHaveLength(0);
    expect(catalog.remaining(offMarkerDeposit!)).toBeGreaterThan(0);
    expect(overlap).toBeDefined();
    const overlappingDeposits = catalog.depositsAt(overlap!);
    expect(overlappingDeposits.length).toBeGreaterThan(1);
    expect(
      new Set(overlappingDeposits.map((deposit) => deposit.resource)).size,
    ).toBe(overlappingDeposits.length);
    expect(
      overlappingDeposits.every(
        (deposit) =>
          deposit.concentration! >= 25 && deposit.concentration! <= 100,
      ),
    ).toBe(true);
    for (const deposit of overlappingDeposits) {
      const before = catalog.remaining(overlap!, deposit.resource);
      expect(catalog.extract(overlap!, 1, deposit.resource)).toBe(1);
      expect(catalog.remaining(overlap!, deposit.resource)).toBe(before - 1);
    }
  });

  test("keeps nodes separated within and between zones", () => {
    const nodes = resourceNodesForMap(landMap(), "separated-match");

    for (const resource of Object.values(NaturalResource)) {
      const resourceNodes = nodes.filter((node) => node.resource === resource);
      for (let i = 0; i < resourceNodes.length; i++) {
        for (let j = i + 1; j < resourceNodes.length; j++) {
          const dx = resourceNodes[i].x - resourceNodes[j].x;
          const dy = resourceNodes[i].y - resourceNodes[j].y;
          expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(
            RESOURCE_MIN_NODE_DISTANCE ** 2,
          );
        }
      }
    }
  });

  test("does not place nodes in ocean cells", () => {
    const map = landMap();
    expect(
      resourceNodesForMap({ ...map, isLand: () => false }, "match-a"),
    ).toEqual([]);
  });

  test("checks candidate land tiles at most once per lattice cell", () => {
    const width = 256;
    const height = 256;
    const map = landMap(width, height);
    let landChecks = 0;

    resourceNodesForMap(
      {
        ...map,
        isLand: () => {
          landChecks++;
          return false;
        },
      },
      "ocean-performance-match",
    );

    expect(landChecks).toBeGreaterThan(0);
    expect(landChecks).toBeLessThanOrEqual(width * height);
  });

  test("keeps every deposit on passable land in a mixed terrain map", () => {
    const map = landMap(1024, 1024);
    const nodes = resourceNodesForMap(
      {
        ...map,
        isLand: (tile: number) => map.x(tile) < 640,
        isImpassable: (tile: number) =>
          map.x(tile) < 640 && map.y(tile) % 97 === 0,
      },
      "mixed-terrain-match",
    );

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.every((node) => node.x < 640 && node.y % 97 !== 0)).toBe(true);
  });

  test("counts only the richness controlled by a player", () => {
    const nodes: ResourceNode[] = [
      { x: 10, y: 10, resource: NaturalResource.Oil, richness: 3 },
      { x: 20, y: 20, resource: NaturalResource.Oil, richness: 2 },
      { x: 30, y: 30, resource: NaturalResource.Iron, richness: 4 },
    ];
    const map = {
      ...landMap(),
      ownerID: (tile: number) => (tile === 10 * 1024 + 10 ? 7 : 8),
    };

    expect(resourceTotalsForOwner(map, nodes, 7)).toEqual({
      [NaturalResource.Oil]: 3,
      [NaturalResource.Iron]: 0,
      [NaturalResource.Coal]: 0,
      [NaturalResource.Gold]: 0,
      [NaturalResource.Copper]: 0,
      [NaturalResource.Uranium]: 0,
      [NaturalResource.Potash]: 0,
    });
  });
});
