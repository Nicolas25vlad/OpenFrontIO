import { UnitType } from "../game/Game";
import {
  ProcessedResource as Product,
  NaturalResource as Raw,
  ResourceType,
} from "../game/Resources";

/** Integer units, percentages and ticks (10 ticks = one second). */
export const ECONOMY = {
  periodTicks: 10,
  mineOutputPerRichness: 2,
  mineRadius: 15,
  mineStockTargets: {
    [Raw.Oil]: 40,
    [Raw.Iron]: 40,
    [Raw.Coal]: 24,
    [Raw.Gold]: 16,
    [Raw.Copper]: 24,
    [Raw.Uranium]: 8,
    [Raw.Potash]: 16,
  },
  maxMinesPerResource: 3,
  urbanRadius: 70,
  urbanBonusPerLevel: 10,
  maxUrbanBonus: 30,
  infrastructureRadius: 90,
  infrastructureBonusPerLevel: 10,
  maxInfrastructureBonus: 40,
  railBonus: 20,
  factoryBatches: 2,
  vehicleFactoryBatches: 1,
  farmFood: 8,
  fertilizedFood: 16,
  nuclearBatches: 1,
  productionRevenue: 150n,
  logisticsPerLevel: 5,
  maxLogisticsBonus: 25,
  reserveCashThreshold: 25_000n,
  goldBarValue: 5000n,
  initialStock: {
    [Product.Food]: 240,
    [Product.Steel]: 80,
    [Product.Circuits]: 10,
    [Product.Fuel]: 60,
  },
} as const;

export type ResourceAmounts = Partial<Record<ResourceType, number>>;

// Mines, farms and basic factories cost money only: industry can always restart.
export const RESOURCE_COSTS: Partial<Record<UnitType, ResourceAmounts>> = {
  [UnitType.City]: { [Product.Steel]: 10 },
  [UnitType.Infrastructure]: { [Product.Steel]: 10 },
  [UnitType.SupplyCenter]: { [Product.Steel]: 20 },
  [UnitType.Port]: { [Product.Steel]: 15 },
  [UnitType.DefensePost]: { [Product.Steel]: 8 },
  [UnitType.Trench]: { [Product.Steel]: 3 },
  [UnitType.VehicleFactory]: { [Product.Steel]: 30, [Product.Circuits]: 5 },
  [UnitType.Warship]: { [Product.Steel]: 20, [Product.Fuel]: 10 },
  [UnitType.SAMLauncher]: { [Product.Steel]: 25, [Product.Circuits]: 10 },
  [UnitType.MissileSilo]: { [Product.Steel]: 30, [Product.Circuits]: 10 },
  [UnitType.NuclearPlant]: { [Product.Steel]: 150, [Product.Circuits]: 40 },
  [UnitType.AtomBomb]: {
    [Product.Steel]: 40,
    [Product.Circuits]: 20,
    [Product.EnrichedUranium]: 12,
  },
  [UnitType.HydrogenBomb]: {
    [Product.Steel]: 120,
    [Product.Circuits]: 60,
    [Product.EnrichedUranium]: 45,
  },
  [UnitType.MIRV]: {
    [Product.Steel]: 100,
    [Product.Circuits]: 80,
    [Product.EnrichedUranium]: 60,
  },
};

export const NUCLEAR_RECIPE = {
  inputs: { [Raw.Uranium]: 3, [Product.Fuel]: 1 },
  amount: 1,
};

/** One tank is assembled from steel and fuel at a vehicle factory. */
export const TANK_RECIPE = {
  inputs: { [Product.Steel]: 5, [Product.Fuel]: 2 },
  amount: 1,
};

export const STRATEGIC_COMBAT = {
  antiIcbmRangeMultiplier: 1.2,
  antiIcbmEfficiencyMultiplier: 1.15,
  defensePostStrength: 6,
  defensePostSlowdown: 4,
  defensePostStrengthPerLevel: 1,
  defensePostSlowdownPerLevel: 1,
  defensePostMaxLevel: 3,
  defensePostMaxHealth: 300,
  defensePostHealthPerLevel: 100,
  defensePostWearPerTile: 25,
  trenchMaxLevel: 3,
  trenchRange: 15,
  trenchDefensePerLevel: 0.08,
  trenchAttackSpeedPerLevel: 0.06,
  trenchOffensiveLossPerLevel: 0.04,
  trenchOffensiveSlowdownPerLevel: 0.05,
  /** Each attacking tank reduces the effective trench bonus by this share. */
  trenchTankCounterPerTank: 0.1,
  trenchTankCounterMax: 0.75,
  trenchWearPerResolvedTile: 1,
  /** One tank joins a land or naval attack for every 10,000 infantry sent. */
  infantryPerTank: 10_000,
  /** Combat strength contributed by one tank, measured in infantry equivalents. */
  tankCombatPower: 5_000,
  /** Tanks take casualties faster than infantry to keep them expendable. */
  tankCasualtyMultiplier: 100,
  /** Each tank increases strategic attack advance speed by 5%, up to 50%. */
  tankAdvanceSpeedPerTankPercent: 5,
  tankAdvanceSpeedMaxPercent: 50,
} as const;

/** Coastal naval sectors are derived from active units; they add no map state. */
export const NAVAL_SUPREMACY = {
  sectorSize: 64,
  blockadeAdvantage: 2,
} as const;

/** Movement pacing for naval transports, measured in simulation ticks per tile. */
export const NAVAL_TRANSPORT = {
  ticksPerTile: 1,
} as const;

/** One-time resource cargo carried by strategic port-to-port trade ships. */
export const NAVAL_TRADE = {
  cargoUnits: 5,
  cargoPricePerUnit: 100n,
  /** Hard strategic cap; legacy trade ships keep their existing behavior. */
  globalRouteLimit: 800,
  exportReserve: {
    [Product.Food]: 120,
    [Product.Fuel]: 30,
    [Product.Steel]: 40,
    [Raw.Oil]: 5,
    [Raw.Iron]: 5,
    [Raw.Coal]: 4,
    [Raw.Gold]: 2,
    [Raw.Copper]: 4,
    [Raw.Uranium]: 1,
    [Raw.Potash]: 3,
    [Product.RefinedIron]: 5,
    [Product.GoldBars]: 2,
    [Product.Circuits]: 3,
    [Product.EnrichedUranium]: 1,
    [Product.Fertilizer]: 3,
  },
  importTarget: {
    [Product.Food]: 240,
    [Product.Fuel]: 60,
    [Product.Steel]: 80,
    [Raw.Oil]: 20,
    [Raw.Iron]: 20,
    [Raw.Coal]: 15,
    [Raw.Gold]: 8,
    [Raw.Copper]: 15,
    [Raw.Uranium]: 5,
    [Raw.Potash]: 10,
    [Product.RefinedIron]: 20,
    [Product.GoldBars]: 8,
    [Product.Circuits]: 12,
    [Product.EnrichedUranium]: 10,
    [Product.Fertilizer]: 15,
  },
  cargoOrder: [
    Product.Food,
    Product.Fuel,
    Product.Steel,
    Raw.Oil,
    Raw.Iron,
    Raw.Coal,
    Raw.Copper,
    Raw.Gold,
    Raw.Uranium,
    Raw.Potash,
    Product.RefinedIron,
    Product.Circuits,
    Product.GoldBars,
    Product.Fertilizer,
    Product.EnrichedUranium,
  ] satisfies readonly ResourceType[],
} as const;

/** Nation AI nuclear launch pacing and repeated-target avoidance. */
export const NUCLEAR_AI = {
  atomBombPerceivedCostIncreasePercent: 50,
  hydrogenBombPerceivedCostIncreasePercent: 25,
  repeatedTargetAvoidanceTicks: 600,
} as const;

export const NUCLEAR_PRODUCTION_TICKS: Partial<Record<UnitType, number>> = {
  [UnitType.AtomBomb]: 300,
  [UnitType.HydrogenBomb]: 600,
  [UnitType.MIRV]: 900,
};

export const INDUSTRIAL_RECIPES: readonly {
  output: Product;
  inputs: ResourceAmounts;
  amount: number;
}[] = [
  { output: Product.Fuel, inputs: { [Raw.Oil]: 2 }, amount: 4 },
  { output: Product.RefinedIron, inputs: { [Raw.Iron]: 2 }, amount: 3 },
  {
    output: Product.Steel,
    inputs: { [Product.RefinedIron]: 2, [Raw.Coal]: 1 },
    amount: 3,
  },
  { output: Product.GoldBars, inputs: { [Raw.Gold]: 3 }, amount: 1 },
  { output: Product.Circuits, inputs: { [Raw.Copper]: 2 }, amount: 2 },
  { output: Product.Fertilizer, inputs: { [Raw.Potash]: 1 }, amount: 3 },
];

export const STRATEGIC_BUILDINGS = {
  [UnitType.Mine]: { gold: 100_000, ticks: 20 },
  [UnitType.Farm]: { gold: 50_000, ticks: 20 },
  [UnitType.Infrastructure]: { gold: 150_000, ticks: 30 },
  [UnitType.Trench]: { gold: 75_000, ticks: 20 },
  [UnitType.SupplyCenter]: { gold: 200_000, ticks: 30 },
  [UnitType.VehicleFactory]: { gold: 500_000, ticks: 50 },
  [UnitType.NuclearPlant]: { gold: 4_000_000, ticks: 150 },
} as const;

/** Eligible strategic logistics nodes; rendering, routing and economy use this metadata. */
export const LOGISTICS_NODES: Partial<Record<UnitType, true>> = {
  [UnitType.City]: true,
  [UnitType.Infrastructure]: true,
  [UnitType.SupplyCenter]: true,
  [UnitType.Mine]: true,
  [UnitType.Farm]: true,
  [UnitType.VehicleFactory]: true,
  [UnitType.NuclearPlant]: true,
  [UnitType.Port]: true,
};

/** Relative contribution of connected buildings to the attack logistics bonus. */
export const LOGISTICS_CAPACITY: Partial<Record<UnitType, number>> = {
  [UnitType.SupplyCenter]: 3,
};
