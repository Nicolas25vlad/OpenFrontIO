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
  infantryPerFood: 5000,
  foodReservePeriods: 6,
  navalFuelPerLevel: 2,
  shipsPerSteel: 5,
  supplyFloor: 35,
  growthFloor: 0.2,
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
  [UnitType.Port]: { [Product.Steel]: 15 },
  [UnitType.DefensePost]: { [Product.Steel]: 8 },
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
  trenchDefensePerLevel: 0.08,
  trenchAttackSpeedPerLevel: 0.06,
  /** A supplied tank reduces the effective trench bonus by this share. */
  trenchTankCounterPerTank: 0.1,
  trenchTankCounterMax: 0.75,
  trenchWearPerResolvedTile: 1,
  trenchSteelPerLevel: 3,
  /** One tank joins a land or naval attack for every 10,000 infantry sent. */
  infantryPerTank: 10_000,
  /** Independently deployed tanks each occupy a unit slot up to this limit. */
  maxDeployedTanksPerPlayer: 24,
  tankUnitMaxHealth: 1_000,
  /** Direct damage applied to a deployed tank by another tank on its tile. */
  tankUnitCombatDamage: 250,
  tankMoveTicksPerTile: 2,
  tankMaxMovementRange: 250,
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

/** One-time resource cargo carried by strategic port-to-port trade ships. */
export const NAVAL_TRADE = {
  cargoUnits: 5,
  cargoPricePerUnit: 100n,
  /** Manual route orders share one small cap per player to bound active work. */
  manualRouteLimitPerPlayer: 3,
  exportReserve: {
    [Product.Food]: 120,
    [Product.Fuel]: 30,
    [Product.Steel]: 40,
  },
  importTarget: {
    [Product.Food]: 240,
    [Product.Fuel]: 60,
    [Product.Steel]: 80,
  },
  cargoOrder: [Product.Food, Product.Fuel, Product.Steel],
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
  [UnitType.VehicleFactory]: { gold: 500_000, ticks: 50 },
  [UnitType.NuclearPlant]: { gold: 4_000_000, ticks: 150 },
} as const;
