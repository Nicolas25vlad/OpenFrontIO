import type { TileRef } from "./GameMap";

/** Natural deposits used by the strategic layer. Values are wire-stable. */
export enum NaturalResource {
  Oil = "oil",
  Iron = "iron",
  Coal = "coal",
  Gold = "gold",
  Copper = "copper",
  Uranium = "uranium",
  Potash = "potash",
}

export const RESOURCE_VALUES = Object.values(NaturalResource);

export enum ProcessedResource {
  Fuel = "fuel",
  RefinedIron = "refined_iron",
  Steel = "steel",
  GoldBars = "gold_bars",
  Circuits = "circuits",
  EnrichedUranium = "enriched_uranium",
  Fertilizer = "fertilizer",
  Food = "food",
}

export type ResourceType = NaturalResource | ProcessedResource;
export const STOCK_RESOURCES: readonly ResourceType[] = [
  ...RESOURCE_VALUES,
  ...Object.values(ProcessedResource),
];

/** Serializable per-player stock. Values are integer units, never tiles. */
export type ResourceStock = Record<ResourceType, number>;

export function emptyResourceStock(): ResourceStock {
  return Object.fromEntries(
    STOCK_RESOURCES.map((resource) => [resource, 0]),
  ) as ResourceStock;
}

export function cloneResourceStock(
  stock: Readonly<ResourceStock>,
): ResourceStock {
  // Old snapshots contain only natural resources.
  return { ...emptyResourceStock(), ...stock };
}

export function resourceStockEqual(
  a?: Readonly<ResourceStock>,
  b?: Readonly<ResourceStock>,
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  for (const resource of STOCK_RESOURCES) {
    if ((a[resource] ?? 0) !== (b[resource] ?? 0)) return false;
  }
  return true;
}

export interface ResourceDeposit {
  resource: NaturalResource;
  /** Integer richness tier. Higher tiers support more extraction later. */
  richness: number;
}

export interface ResourceNode extends ResourceDeposit {
  /** Stable map position used by the renderer and future extraction logic. */
  x: number;
  y: number;
}

export const RESOURCE_RESERVE_PER_RICHNESS = 3000;

export function resourceReserveFor(richness: number): number {
  return Math.max(0, Math.floor(richness)) * RESOURCE_RESERVE_PER_RICHNESS;
}

export interface ResourceNoiseConfig {
  /** World-tile distance between broad noise samples. */
  scale: number;
  /** Multiplier for the noise coordinate; higher values make smaller zones. */
  frequency: number;
  /** Base noise value required for a resource to exist. */
  threshold: number;
  /** How much the threshold is relaxed for abundant resources. */
  abundance: number;
}

export interface ResourceContinentZone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const RESOURCE_NODE_CELL_SIZE = 128;
export const RESOURCE_NODE_MARGIN = 32;
export const RESOURCE_MIN_NODE_DISTANCE =
  RESOURCE_NODE_CELL_SIZE - RESOURCE_NODE_MARGIN * 2;

/** Normalized equirectangular zones for the six continents on the world map. */
export const RESOURCE_CONTINENT_ZONES: Readonly<
  Record<string, ResourceContinentZone>
> = {
  Antarctica: { minX: 0.04, maxX: 0.96, minY: 0.82, maxY: 1 },
  SouthAmerica: { minX: 0.22, maxX: 0.46, minY: 0.38, maxY: 0.84 },
  NorthAmerica: { minX: 0.02, maxX: 0.38, minY: 0.08, maxY: 0.48 },
  Africa: { minX: 0.38, maxX: 0.58, minY: 0.3, maxY: 0.76 },
  Europe: { minX: 0.4, maxX: 0.58, minY: 0.1, maxY: 0.38 },
  Asia: { minX: 0.52, maxX: 0.98, minY: 0.08, maxY: 0.58 },
};

/** Tune resource belts here without changing the generation algorithm. */
export const RESOURCE_GENERATION_CONFIG: Readonly<
  Record<NaturalResource, ResourceNoiseConfig>
> = {
  [NaturalResource.Oil]: {
    scale: 520,
    frequency: 0.9,
    threshold: 0.55,
    abundance: 0.9,
  },
  [NaturalResource.Iron]: {
    scale: 460,
    frequency: 1.05,
    threshold: 0.56,
    abundance: 0.82,
  },
  [NaturalResource.Coal]: {
    scale: 560,
    frequency: 0.8,
    threshold: 0.58,
    abundance: 0.76,
  },
  [NaturalResource.Gold]: {
    scale: 360,
    frequency: 1.1,
    threshold: 0.68,
    abundance: 0.42,
  },
  [NaturalResource.Copper]: {
    scale: 430,
    frequency: 1,
    threshold: 0.6,
    abundance: 0.68,
  },
  [NaturalResource.Uranium]: {
    scale: 680,
    frequency: 0.72,
    threshold: 0.69,
    abundance: 0.38,
  },
  [NaturalResource.Potash]: {
    scale: 500,
    frequency: 0.88,
    threshold: 0.59,
    abundance: 0.62,
  },
};

interface ResourceMapLike {
  width(): number;
  height(): number;
  ref(x: number, y: number): TileRef;
  x(tile: TileRef): number;
  y(tile: TileRef): number;
  isLand(tile: TileRef): boolean;
  isImpassable?(tile: TileRef): boolean;
}

type ResourceSeed = string | number;

const NOISE_OCTAVES = 4;
const NOISE_PERSISTENCE = 0.5;
const RICHNESS_THRESHOLDS = [0, 0.08, 0.18, 0.3];
const RESOURCE_CACHE = new WeakMap<object, Map<string, ResourceNode[]>>();

function seedNumber(seed: ResourceSeed): number {
  if (typeof seed === "number") return seed >>> 0;

  let value = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function hash(seed: number, x: number, y: number, salt: number): number {
  let value =
    (seed ^ Math.imul(x, 0x45d9f3b) ^ Math.imul(y, 0x119de1f3) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function valueNoise(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const sample = (sampleX: number, sampleY: number) =>
    hash(seed, sampleX, sampleY, 0x6a09e667) / 0xffffffff;
  const top = sample(x0, y0) * (1 - tx) + sample(x0 + 1, y0) * tx;
  const bottom = sample(x0, y0 + 1) * (1 - tx) + sample(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function fractalNoise(
  seed: number,
  x: number,
  y: number,
  config: ResourceNoiseConfig,
): number {
  let frequency = config.frequency;
  let amplitude = 1;
  let total = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < NOISE_OCTAVES; octave++) {
    total +=
      valueNoise(
        hash(seed, octave, 0, 0xbb67ae85),
        (x / config.scale) * frequency,
        (y / config.scale) * frequency,
      ) * amplitude;
    amplitudeTotal += amplitude;
    frequency *= 2;
    amplitude *= NOISE_PERSISTENCE;
  }

  return total / amplitudeTotal;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function findLandTile(
  map: ResourceMapLike,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  preferredX: number,
  preferredY: number,
  isAllowed: (tile: TileRef) => boolean = () => true,
): TileRef | null {
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const columns = Math.ceil(width / 4);
  const rows = Math.ceil(height / 4);
  const startColumn = Math.floor((preferredX - minX) / 4) % columns;
  const startRow = Math.floor((preferredY - minY) / 4) % rows;

  const validLandTile = (x: number, y: number): TileRef | null => {
    const tile = map.ref(x, y);
    return map.isLand(tile) && !map.isImpassable?.(tile) ? tile : null;
  };

  for (let rowOffset = 0; rowOffset < rows; rowOffset++) {
    const y = Math.min(maxY, minY + ((startRow + rowOffset) % rows) * 4);
    for (let columnOffset = 0; columnOffset < columns; columnOffset++) {
      const x = Math.min(
        maxX,
        minX + ((startColumn + columnOffset) % columns) * 4,
      );
      const tile = validLandTile(x, y);
      if (tile !== null && isAllowed(tile)) return tile;
    }
  }

  // ponytail: sampled lookup plus exact fallback; replace with a land mask if map sizes make this hot.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const tile = validLandTile(x, y);
      if (tile !== null && isAllowed(tile)) return tile;
    }
  }
  return null;
}

interface ResourceOwnerMapLike extends ResourceMapLike {
  ownerID(tile: TileRef): number;
}

function cacheKey(seed: ResourceSeed): string {
  return `${typeof seed}:${seed}`;
}

function richnessForNoise(noise: number, threshold: number): number {
  const remainingNoise = Math.max(0, 1 - threshold);
  let richness = 0;
  for (const band of RICHNESS_THRESHOLDS) {
    if (noise >= threshold + remainingNoise * band) richness++;
  }
  return richness;
}

function zoneBounds(
  map: ResourceMapLike,
  zone: ResourceContinentZone,
): [number, number, number, number] {
  return [
    clamp(Math.floor(zone.minX * map.width()), 0, map.width() - 1),
    clamp(Math.ceil(zone.maxX * map.width()) - 1, 0, map.width() - 1),
    clamp(Math.floor(zone.minY * map.height()), 0, map.height() - 1),
    clamp(Math.ceil(zone.maxY * map.height()) - 1, 0, map.height() - 1),
  ];
}

function nodeInZone(
  node: ResourceNode,
  resource: NaturalResource,
  map: ResourceMapLike,
  zone: ResourceContinentZone,
): boolean {
  return (
    node.resource === resource &&
    node.x >= zone.minX * map.width() &&
    node.x < zone.maxX * map.width() &&
    node.y >= zone.minY * map.height() &&
    node.y < zone.maxY * map.height()
  );
}

/**
 * Generates a cached, deterministic resource catalog for a match.
 *
 * Each resource gets an independent fractal-noise layer. One candidate per
 * lattice cell turns eligible cells into broad zones instead of isolated
 * points; the renderer can blend neighbouring candidates into belts.
 */
export function resourceNodesForMap(
  map: ResourceMapLike,
  matchSeed: ResourceSeed,
): ResourceNode[] {
  const mapCache =
    RESOURCE_CACHE.get(map as object) ?? new Map<string, ResourceNode[]>();
  RESOURCE_CACHE.set(map as object, mapCache);

  const key = cacheKey(matchSeed);
  const cached = mapCache.get(key);
  if (cached) return cached;

  const seed = seedNumber(matchSeed);
  const nodes: ResourceNode[] = [];
  const coveredCells = new Set<string>();
  const cellsWide = Math.ceil(map.width() / RESOURCE_NODE_CELL_SIZE);
  const cellsHigh = Math.ceil(map.height() / RESOURCE_NODE_CELL_SIZE);

  RESOURCE_VALUES.forEach((resource, resourceIndex) => {
    const config = RESOURCE_GENERATION_CONFIG[resource];
    const resourceSeed = hash(seed, resourceIndex, 0, 0x3c6ef372);
    const threshold = clamp(
      config.threshold - (config.abundance - 0.5) * 0.1,
      0.05,
      0.95,
    );

    for (let cellY = 0; cellY < cellsHigh; cellY++) {
      for (let cellX = 0; cellX < cellsWide; cellX++) {
        const originX = cellX * RESOURCE_NODE_CELL_SIZE;
        const originY = cellY * RESOURCE_NODE_CELL_SIZE;
        const endX = Math.min(
          map.width() - 1,
          originX + RESOURCE_NODE_CELL_SIZE - 1,
        );
        const endY = Math.min(
          map.height() - 1,
          originY + RESOURCE_NODE_CELL_SIZE - 1,
        );

        if (
          endX - originX + 1 <= RESOURCE_NODE_MARGIN * 2 ||
          endY - originY + 1 <= RESOURCE_NODE_MARGIN * 2
        ) {
          continue;
        }

        const sampleX = originX + RESOURCE_NODE_CELL_SIZE / 2;
        const sampleY = originY + RESOURCE_NODE_CELL_SIZE / 2;
        const noise = fractalNoise(resourceSeed, sampleX, sampleY, config);
        if (noise < threshold) continue;

        const minX = originX + RESOURCE_NODE_MARGIN;
        const maxX = endX - RESOURCE_NODE_MARGIN;
        const minY = originY + RESOURCE_NODE_MARGIN;
        const maxY = endY - RESOURCE_NODE_MARGIN;
        const preferredX =
          minX +
          (hash(resourceSeed, cellX, cellY, 0x243f6a88) % (maxX - minX + 1));
        const preferredY =
          minY +
          (hash(resourceSeed, cellX, cellY, 0x85a308d3) % (maxY - minY + 1));
        const tile = findLandTile(
          map,
          minX,
          maxX,
          minY,
          maxY,
          preferredX,
          preferredY,
        );
        if (tile === null) continue;

        const x = map.x(tile);
        const y = map.y(tile);
        nodes.push({
          x,
          y,
          resource,
          richness: richnessForNoise(noise, threshold),
        });
        coveredCells.add(`${cellX}:${cellY}`);
      }
    }
  });

  for (const [continentIndex, zone] of Object.values(
    RESOURCE_CONTINENT_ZONES,
  ).entries()) {
    const [minX, maxX, minY, maxY] = zoneBounds(map, zone);
    if (maxX - minX + 1 <= RESOURCE_NODE_MARGIN * 2) continue;
    if (maxY - minY + 1 <= RESOURCE_NODE_MARGIN * 2) continue;

    for (const [resourceIndex, resource] of RESOURCE_VALUES.entries()) {
      if (nodes.some((node) => nodeInZone(node, resource, map, zone))) {
        continue;
      }

      const continentSeed = hash(
        seed,
        continentIndex,
        resourceIndex,
        0x510e527f,
      );
      const tile = findLandTile(
        map,
        minX,
        maxX,
        minY,
        maxY,
        minX + (continentSeed % (maxX - minX + 1)),
        minY +
          (hash(continentSeed, minX, minY, 0x9b05688c) % (maxY - minY + 1)),
        (candidate) => {
          const x = map.x(candidate);
          const y = map.y(candidate);
          return nodes.every(
            (node) =>
              node.resource !== resource ||
              (node.x - x) ** 2 + (node.y - y) ** 2 >=
                RESOURCE_MIN_NODE_DISTANCE ** 2,
          );
        },
      );
      if (tile === null) continue;

      nodes.push({
        x: map.x(tile),
        y: map.y(tile),
        resource,
        richness: 2 + (continentSeed % 3),
      });
    }
  }

  // Guarantee a minimum strategic footprint without making any one resource
  // uniform: uncovered land cells inherit a low-richness resource from a
  // coarse deterministic patch selector.
  for (let cellY = 0; cellY < cellsHigh; cellY++) {
    for (let cellX = 0; cellX < cellsWide; cellX++) {
      const originX = cellX * RESOURCE_NODE_CELL_SIZE;
      const originY = cellY * RESOURCE_NODE_CELL_SIZE;
      const endX = Math.min(
        map.width() - 1,
        originX + RESOURCE_NODE_CELL_SIZE - 1,
      );
      const endY = Math.min(
        map.height() - 1,
        originY + RESOURCE_NODE_CELL_SIZE - 1,
      );
      if (
        endX - originX + 1 <= RESOURCE_NODE_MARGIN * 2 ||
        endY - originY + 1 <= RESOURCE_NODE_MARGIN * 2 ||
        coveredCells.has(`${cellX}:${cellY}`)
      ) {
        continue;
      }

      const minX = originX + RESOURCE_NODE_MARGIN;
      const maxX = endX - RESOURCE_NODE_MARGIN;
      const minY = originY + RESOURCE_NODE_MARGIN;
      const maxY = endY - RESOURCE_NODE_MARGIN;
      const fallbackSeed = hash(
        seed,
        Math.floor(cellX / 2),
        Math.floor(cellY / 2),
        0xa54ff53a,
      );
      const tile = findLandTile(
        map,
        minX,
        maxX,
        minY,
        maxY,
        minX + (fallbackSeed % (maxX - minX + 1)),
        minY +
          (hash(fallbackSeed, cellX, cellY, 0x13198a2e) % (maxY - minY + 1)),
      );
      if (tile === null) continue;

      nodes.push({
        x: map.x(tile),
        y: map.y(tile),
        resource: RESOURCE_VALUES[fallbackSeed % RESOURCE_VALUES.length],
        richness: 1 + (fallbackSeed % 2),
      });
    }
  }

  nodes.sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      RESOURCE_VALUES.indexOf(a.resource) - RESOURCE_VALUES.indexOf(b.resource),
  );
  mapCache.set(key, nodes);
  return nodes;
}

export function resourceTotalsForOwner(
  map: ResourceOwnerMapLike,
  nodes: readonly ResourceNode[],
  ownerID: number,
): Record<NaturalResource, number> {
  const totals = Object.fromEntries(
    RESOURCE_VALUES.map((resource) => [resource, 0]),
  ) as Record<NaturalResource, number>;

  for (const node of nodes) {
    if (map.ownerID(map.ref(node.x, node.y)) === ownerID) {
      totals[node.resource] += node.richness;
    }
  }
  return totals;
}

/** Match-local reserves in the deterministic simulation, separate from the visual cache. */
export class ResourceCatalog {
  private readonly reserves = new Map<TileRef, Map<NaturalResource, number>>();
  private readonly nodesByTile = new Map<TileRef, readonly ResourceNode[]>();
  private depletedHash = 0;

  readonly nodes: readonly ResourceNode[];

  constructor(
    private readonly map: ResourceMapLike,
    matchSeed: ResourceSeed,
    nodes: readonly ResourceNode[] = resourceNodesForMap(map, matchSeed),
  ) {
    this.nodes = Object.freeze(nodes.map((node) => Object.freeze({ ...node })));
    for (const node of this.nodes) {
      const tile = map.ref(node.x, node.y);
      this.nodesByTile.set(
        tile,
        Object.freeze([...(this.nodesByTile.get(tile) ?? []), node]),
      );
      const reserves =
        this.reserves.get(tile) ?? new Map<NaturalResource, number>();
      reserves.set(node.resource, resourceReserveFor(node.richness));
      this.reserves.set(tile, reserves);
    }
  }

  nodeAt(tile: TileRef): ResourceNode | undefined {
    return this.depositsAt(tile)[0];
  }

  depositsAt(tile: TileRef): readonly ResourceNode[] {
    if (!this.map.isLand(tile) || this.map.isImpassable?.(tile)) return [];
    return this.nodesByTile.get(tile) ?? [];
  }

  extract(
    tile: TileRef,
    amount: number,
    resource = this.nodeAt(tile)?.resource,
  ): number {
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      resource === undefined ||
      !this.depositsAt(tile).some((node) => node.resource === resource)
    ) {
      return 0;
    }
    const available = this.remaining(tile, resource);
    const extracted = Math.min(available, Math.floor(amount));
    if (extracted > 0) {
      this.reserves.get(tile)!.set(resource, available - extracted);
      this.depletedHash =
        (this.depletedHash +
          Math.imul(
            extracted,
            (tile + 1) * (RESOURCE_VALUES.indexOf(resource) + 1),
          )) |
        0;
    }
    return extracted;
  }

  remaining(tile: TileRef, resource = this.nodeAt(tile)?.resource): number {
    return resource === undefined
      ? 0
      : (this.reserves.get(tile)?.get(resource) ?? 0);
  }

  hash(): number {
    return this.depletedHash;
  }
}
