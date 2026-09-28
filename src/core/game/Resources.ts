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
  /** Integer richness tier from 1 (edge) to 4 (very rich). */
  richness: number;
  /** Local concentration on a 25–100 scale. */
  concentration?: number;
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

export const RESOURCE_NODE_CELL_SIZE = 48;
const MIN_RESOURCE_NODE_CELL_SIZE = 32;
const RESOURCE_NOISE_REFERENCE_SIZE = 1024;
export const RESOURCE_FIELD_CELL_SIZE = 8;
export const RESOURCE_NODE_MARGIN = 8;
export const RESOURCE_MIN_NODE_DISTANCE = RESOURCE_NODE_MARGIN * 2 + 1;

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
    threshold: 0.61,
    abundance: 0.55,
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

/** Keeps deposit density and map overlay scale useful on small maps. */
export function resourceNodeCellSizeForMap(
  map: Pick<ResourceMapLike, "width" | "height">,
): number {
  return Math.min(
    RESOURCE_NODE_CELL_SIZE,
    Math.max(
      MIN_RESOURCE_NODE_CELL_SIZE,
      Math.floor(Math.min(map.width(), map.height()) / 4),
    ),
  );
}

type ResourceSeed = string | number;

const NOISE_OCTAVES = 4;
const NOISE_PERSISTENCE = 0.5;
const NOISE_WARP_FREQUENCY = 0.38;
const NOISE_WARP_STRENGTH = 0.18;
interface ResourceNoiseField {
  values: Uint8Array;
  cellsWide: number;
  cellsHigh: number;
  threshold: number;
}

interface ResourceDistribution {
  nodes: readonly ResourceNode[];
  fields: Readonly<Record<NaturalResource, ResourceNoiseField>>;
}

const RESOURCE_CACHE = new WeakMap<object, Map<string, ResourceDistribution>>();

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

function fractalNoiseAt(seed: number, x: number, y: number): number {
  let frequency = 1;
  let amplitude = 1;
  let total = 0;
  let amplitudeTotal = 0;

  for (let octave = 0; octave < NOISE_OCTAVES; octave++) {
    total +=
      valueNoise(
        hash(seed, octave, 0, 0xbb67ae85),
        x * frequency,
        y * frequency,
      ) * amplitude;
    amplitudeTotal += amplitude;
    frequency *= 2;
    amplitude *= NOISE_PERSISTENCE;
  }

  return total / amplitudeTotal;
}

/**
 * Domain-warp the broad field before thresholding it. Sampling two independent
 * low-frequency fields bends the resource belts without adding isolated spots;
 * all inputs are integer-seeded and the result is cached with the map catalog.
 */
function warpedFractalNoise(
  seed: number,
  x: number,
  y: number,
  config: ResourceNoiseConfig,
): number {
  const baseX = (x / config.scale) * config.frequency;
  const baseY = (y / config.scale) * config.frequency;
  const warpSeedX = hash(seed, 0, 0, 0x510e527f);
  const warpSeedY = hash(seed, 1, 0, 0x9b05688c);
  const warpX =
    (valueNoise(
      warpSeedX,
      baseX * NOISE_WARP_FREQUENCY,
      baseY * NOISE_WARP_FREQUENCY,
    ) -
      0.5) *
    NOISE_WARP_STRENGTH;
  const warpY =
    (valueNoise(
      warpSeedY,
      baseX * NOISE_WARP_FREQUENCY,
      baseY * NOISE_WARP_FREQUENCY,
    ) -
      0.5) *
    NOISE_WARP_STRENGTH;

  return fractalNoiseAt(seed, baseX + warpX, baseY + warpY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface ResourceOwnerMapLike extends ResourceMapLike {
  ownerID(tile: TileRef): number;
}

function cacheKey(seed: ResourceSeed): string {
  return `${typeof seed}:${seed}`;
}

/**
 * Samples a cached low-resolution noise field at any map position. Bilinear
 * interpolation keeps concentration changes gradual without storing a value
 * for every map tile.
 */
function noiseFieldAt(field: ResourceNoiseField, x: number, y: number): number {
  const gridX = clamp(x / RESOURCE_FIELD_CELL_SIZE, 0, field.cellsWide - 1);
  const gridY = clamp(y / RESOURCE_FIELD_CELL_SIZE, 0, field.cellsHigh - 1);
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(field.cellsWide - 1, x0 + 1);
  const y1 = Math.min(field.cellsHigh - 1, y0 + 1);
  const tx = gridX - x0;
  const ty = gridY - y0;
  const at = (sampleX: number, sampleY: number) =>
    field.values[sampleY * field.cellsWide + sampleX] / 255;
  const top = at(x0, y0) * (1 - tx) + at(x1, y0) * tx;
  const bottom = at(x0, y1) * (1 - tx) + at(x1, y1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function concentrationAtNoise(
  noise: number,
  threshold: number,
): number | undefined {
  if (noise < threshold) return undefined;
  const concentration =
    25 + (75 * (noise - threshold)) / Math.max(Number.EPSILON, 1 - threshold);
  return Math.max(25, Math.min(100, Math.round(concentration)));
}

function resourceRichness(concentration: number): number {
  return Math.max(1, Math.min(4, Math.ceil(concentration / 25)));
}

function resourceDistributionForMap(
  map: ResourceMapLike,
  matchSeed: ResourceSeed,
): ResourceDistribution {
  const mapCache =
    RESOURCE_CACHE.get(map as object) ??
    new Map<string, ResourceDistribution>();
  RESOURCE_CACHE.set(map as object, mapCache);

  const key = cacheKey(matchSeed);
  const cached = mapCache.get(key);
  if (cached) return cached;

  const seed = seedNumber(matchSeed);
  const cellSize = resourceNodeCellSizeForMap(map);
  const margin = Math.min(RESOURCE_NODE_MARGIN, Math.floor(cellSize / 4));
  const mapScale = Math.max(
    0.25,
    Math.min(
      1,
      Math.min(map.width(), map.height()) / RESOURCE_NOISE_REFERENCE_SIZE,
    ),
  );
  const fields = {} as Record<NaturalResource, ResourceNoiseField>;

  RESOURCE_VALUES.forEach((resource, resourceIndex) => {
    const config = RESOURCE_GENERATION_CONFIG[resource];
    const threshold = clamp(
      config.threshold - (config.abundance - 0.5) * 0.1,
      0.05,
      0.95,
    );
    const cellsWide =
      Math.ceil(Math.max(0, map.width() - 1) / RESOURCE_FIELD_CELL_SIZE) + 1;
    const cellsHigh =
      Math.ceil(Math.max(0, map.height() - 1) / RESOURCE_FIELD_CELL_SIZE) + 1;
    const values = new Uint8Array(cellsWide * cellsHigh);
    const resourceSeed = hash(seed, resourceIndex, 0, 0x3c6ef372);
    const noiseConfig = {
      ...config,
      scale: config.scale * mapScale,
    };

    for (let gridY = 0; gridY < cellsHigh; gridY++) {
      const y = Math.min(map.height() - 1, gridY * RESOURCE_FIELD_CELL_SIZE);
      for (let gridX = 0; gridX < cellsWide; gridX++) {
        const x = Math.min(map.width() - 1, gridX * RESOURCE_FIELD_CELL_SIZE);
        values[gridY * cellsWide + gridX] = Math.round(
          warpedFractalNoise(resourceSeed, x, y, noiseConfig) * 255,
        );
      }
    }
    fields[resource] = { values, cellsWide, cellsHigh, threshold };
  });

  const nodes: ResourceNode[] = [];
  const cellsWide = Math.ceil(map.width() / cellSize);
  const cellsHigh = Math.ceil(map.height() / cellSize);
  // Cache passable land candidates for cells selected by any resource layer.
  const landTilesByCell = new Map<number, readonly TileRef[]>();
  const landTilesInCell = (
    cellX: number,
    cellY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): readonly TileRef[] => {
    const cellIndex = cellY * cellsWide + cellX;
    const cachedTiles = landTilesByCell.get(cellIndex);
    if (cachedTiles) return cachedTiles;

    const tiles: TileRef[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = map.ref(x, y);
        if (map.isLand(tile) && !map.isImpassable?.(tile)) tiles.push(tile);
      }
    }
    landTilesByCell.set(cellIndex, tiles);
    return tiles;
  };

  RESOURCE_VALUES.forEach((resource) => {
    const field = fields[resource];
    for (let cellY = 0; cellY < cellsHigh; cellY++) {
      for (let cellX = 0; cellX < cellsWide; cellX++) {
        const originX = cellX * cellSize;
        const originY = cellY * cellSize;
        const endX = Math.min(map.width() - 1, originX + cellSize - 1);
        const endY = Math.min(map.height() - 1, originY + cellSize - 1);

        if (
          endX - originX + 1 <= margin * 2 ||
          endY - originY + 1 <= margin * 2
        ) {
          continue;
        }

        const centerNoise = noiseFieldAt(
          field,
          originX + cellSize / 2,
          originY + cellSize / 2,
        );
        if (centerNoise < field.threshold) continue;

        const minX = originX + margin;
        const maxX = endX - margin;
        const minY = originY + margin;
        const maxY = endY - margin;
        const landTiles = landTilesInCell(cellX, cellY, minX, maxX, minY, maxY);
        if (landTiles.length === 0) continue;
        const start = hash(
          seed,
          cellX,
          cellY,
          RESOURCE_VALUES.indexOf(resource),
        );
        let selected: TileRef | undefined;
        let concentration: number | undefined;
        for (let offset = 0; offset < landTiles.length; offset++) {
          const candidate = landTiles[(start + offset) % landTiles.length];
          const candidateConcentration = concentrationAtNoise(
            noiseFieldAt(field, map.x(candidate), map.y(candidate)),
            field.threshold,
          );
          if (candidateConcentration === undefined) continue;
          selected = candidate;
          concentration = candidateConcentration;
          break;
        }
        if (selected === undefined || concentration === undefined) continue;
        nodes.push({
          x: map.x(selected),
          y: map.y(selected),
          resource,
          richness: resourceRichness(concentration),
          concentration,
        });
      }
    }
  });

  nodes.sort(
    (a, b) =>
      a.y - b.y ||
      a.x - b.x ||
      RESOURCE_VALUES.indexOf(a.resource) - RESOURCE_VALUES.indexOf(b.resource),
  );
  const distribution: ResourceDistribution = {
    nodes: Object.freeze(nodes.map((node) => Object.freeze({ ...node }))),
    fields,
  };
  mapCache.set(key, distribution);
  return distribution;
}

/** Generates a cached, deterministic resource catalog for a match. */
export function resourceNodesForMap(
  map: ResourceMapLike,
  matchSeed: ResourceSeed,
): readonly ResourceNode[] {
  return resourceDistributionForMap(map, matchSeed).nodes;
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
  private readonly depositsByTile = new Map<TileRef, readonly ResourceNode[]>();
  private depletedHash = 0;
  private readonly fields: Readonly<
    Record<NaturalResource, ResourceNoiseField>
  >;
  private readonly useNoiseField: boolean;

  readonly nodes: readonly ResourceNode[];

  constructor(
    private readonly map: ResourceMapLike,
    matchSeed: ResourceSeed,
    nodes?: readonly ResourceNode[],
  ) {
    this.useNoiseField = nodes === undefined;
    const distribution = nodes
      ? undefined
      : resourceDistributionForMap(map, matchSeed);
    this.fields =
      distribution?.fields ??
      (Object.fromEntries(
        RESOURCE_VALUES.map((resource) => [
          resource,
          {
            values: new Uint8Array(0),
            cellsWide: 0,
            cellsHigh: 0,
            threshold: 1,
          },
        ]),
      ) as Record<NaturalResource, ResourceNoiseField>);
    this.nodes = Object.freeze(
      (nodes ?? distribution!.nodes).map((node) => Object.freeze({ ...node })),
    );
    for (const node of this.nodes) {
      const tile = map.ref(node.x, node.y);
      this.nodesByTile.set(
        tile,
        Object.freeze([...(this.nodesByTile.get(tile) ?? []), node]),
      );
    }
  }

  nodeAt(tile: TileRef): ResourceNode | undefined {
    return this.depositsAt(tile)[0];
  }

  depositsAt(tile: TileRef): readonly ResourceNode[] {
    if (!this.map.isLand(tile) || this.map.isImpassable?.(tile)) return [];
    const cached = this.depositsByTile.get(tile);
    if (cached) return cached;
    if (!this.useNoiseField) return this.nodesByTile.get(tile) ?? [];

    const deposits: ResourceNode[] = [];
    const x = this.map.x(tile);
    const y = this.map.y(tile);
    for (const resource of RESOURCE_VALUES) {
      const field = this.fields[resource];
      const concentration = concentrationAtNoise(
        noiseFieldAt(field, x, y),
        field.threshold,
      );
      if (concentration === undefined) continue;
      deposits.push({
        x,
        y,
        resource,
        richness: resourceRichness(concentration),
        concentration,
      });
    }
    const immutableDeposits = Object.freeze(
      deposits.map((deposit) => Object.freeze(deposit)),
    );
    this.depositsByTile.set(tile, immutableDeposits);
    return immutableDeposits;
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
    if (resource === undefined) return 0;
    const deposit = this.depositsAt(tile).find(
      (candidate) => candidate.resource === resource,
    );
    if (deposit === undefined) return 0;
    const tileReserves =
      this.reserves.get(tile) ?? new Map<NaturalResource, number>();
    if (!this.reserves.has(tile)) this.reserves.set(tile, tileReserves);
    if (!tileReserves.has(resource)) {
      tileReserves.set(resource, resourceReserveFor(deposit.richness));
    }
    return tileReserves.get(resource)!;
  }

  hash(): number {
    return this.depletedHash;
  }
}
