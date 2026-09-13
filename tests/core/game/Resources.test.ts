import { describe, expect, test } from "vitest";
import {
  NaturalResource,
  RESOURCE_CONTINENT_ZONES,
  RESOURCE_GENERATION_CONFIG,
  RESOURCE_MIN_NODE_DISTANCE,
  RESOURCE_NODE_CELL_SIZE,
  ResourceNode,
  resourceNodesForMap,
  resourceTotalsForOwner,
} from "../../../src/core/game/Resources";

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

  test("changes locations between match seeds", () => {
    const map = landMap();

    expect(resourceNodesForMap(map, "match-a")).not.toEqual(
      resourceNodesForMap(map, "match-b"),
    );
  });

  test("creates broad independent zones with gradual richness", () => {
    const nodes = resourceNodesForMap(landMap(2048, 1024), "zone-match");
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

    for (const resource of Object.values(NaturalResource)) {
      const resourceNodes = nodes.filter((node) => node.resource === resource);
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
    }

    expect(
      nodes.every((node) =>
        Object.values(NaturalResource).includes(node.resource),
      ),
    ).toBe(true);
  });

  test("covers every valid map cell with at least one resource", () => {
    const cellCount = (1024 / RESOURCE_NODE_CELL_SIZE) ** 2;
    const nodes = resourceNodesForMap(landMap(), "coverage-match");
    const coveredCells = new Set(
      nodes.map(
        (node) =>
          `${Math.floor(node.x / RESOURCE_NODE_CELL_SIZE)}:${Math.floor(
            node.y / RESOURCE_NODE_CELL_SIZE,
          )}`,
      ),
    );

    expect(coveredCells.size).toBe(cellCount);
  });

  test("guarantees every resource in every major continent zone", () => {
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

      for (const resource of Object.values(NaturalResource)) {
        expect(zoneNodes.some((node) => node.resource === resource)).toBe(true);
      }
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
