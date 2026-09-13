import { ECONOMY, ResourceAmounts } from "../configuration/StrategyConfig";
import { Game, Player, Unit, UnitType } from "./Game";
import {
  emptyResourceStock,
  ResourceStock,
  resourceStockEqual,
  ResourceType,
  STOCK_RESOURCES,
} from "./Resources";

export interface ResourceRates {
  production: ResourceStock;
  consumption: ResourceStock;
}

export interface SupplyStatus {
  infantry: number;
  navy: number;
  foodDemand: number;
  fuelDemand: number;
  steelDemand: number;
  logistics: number;
}

export const FULL_SUPPLY: Readonly<SupplyStatus> = {
  infantry: 100,
  navy: 100,
  foodDemand: 0,
  fuelDemand: 0,
  steelDemand: 0,
  logistics: 0,
};

export function supplyEqual(
  a?: Readonly<SupplyStatus>,
  b?: Readonly<SupplyStatus>,
): boolean {
  return (
    a === b ||
    (!!a &&
      !!b &&
      a.infantry === b.infantry &&
      a.navy === b.navy &&
      a.foodDemand === b.foodDemand &&
      a.fuelDemand === b.fuelDemand &&
      a.steelDemand === b.steelDemand &&
      a.logistics === b.logistics)
  );
}

export function supplyMultiplier(percent = 100): number {
  return (
    (ECONOMY.supplyFloor +
      ((100 - ECONOMY.supplyFloor) * Math.max(0, Math.min(100, percent))) /
        100) /
    100
  );
}

export interface ProductionStatus {
  efficiency: number;
  urbanBonus: number;
  infrastructureBonus: number;
  produced: number;
  shortage: boolean;
  exhausted?: boolean;
}

export function emptyResourceRates(): ResourceRates {
  return {
    production: emptyResourceStock(),
    consumption: emptyResourceStock(),
  };
}

export function resourceRatesEqual(
  a?: ResourceRates,
  b?: ResourceRates,
): boolean {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      resourceStockEqual(a.production, b.production) &&
      resourceStockEqual(a.consumption, b.consumption))
  );
}

export function hasResources(
  player: Pick<Player, "resourceAmount">,
  amounts: ResourceAmounts,
): boolean {
  return Object.entries(amounts).every(
    ([resource, amount]) =>
      STOCK_RESOURCES.includes(resource as ResourceType) &&
      Number.isSafeInteger(amount) &&
      amount >= 0 &&
      player.resourceAmount(resource as ResourceType) >= amount,
  );
}

/** Check every input before consuming any: no partial recipes. */
export function consumeResources(
  player: Player,
  amounts: ResourceAmounts,
): boolean {
  if (!hasResources(player, amounts)) return false;
  for (const resource of STOCK_RESOURCES) {
    const amount = amounts[resource];
    if (amount) player.removeResource(resource, amount);
  }
  return true;
}

/** Uses the existing spatial index and rail connectivity, once per production period. */
export function productionEfficiency(game: Game, unit: Unit): ProductionStatus {
  const owner = unit.owner();
  let cityLevel = 0;
  const stations = game.railNetwork().stationManager();
  let connected = (stations.findStation(unit)?.getCluster()?.size() ?? 0) > 1;
  let infrastructureLevel = 0;
  for (const { unit: nearby, distSquared } of game.nearbyUnits(
    unit.tile(),
    Math.max(ECONOMY.urbanRadius, ECONOMY.infrastructureRadius),
    [UnitType.City, UnitType.Infrastructure, UnitType.Factory, UnitType.Port],
  )) {
    if (nearby.owner() !== owner) continue;
    connected ||= (stations.findStation(nearby)?.getCluster()?.size() ?? 0) > 1;
    if (
      nearby.type() === UnitType.City &&
      distSquared <= ECONOMY.urbanRadius ** 2
    ) {
      cityLevel = Math.max(cityLevel, nearby.level());
    }
    if (nearby.type() === UnitType.Infrastructure)
      infrastructureLevel = Math.max(infrastructureLevel, nearby.level());
  }
  const urbanBonus = Math.min(
    ECONOMY.maxUrbanBonus,
    cityLevel * ECONOMY.urbanBonusPerLevel,
  );
  const infrastructureBonus = Math.min(
    ECONOMY.maxInfrastructureBonus,
    infrastructureLevel * ECONOMY.infrastructureBonusPerLevel +
      (connected ? ECONOMY.railBonus : 0),
  );
  return {
    efficiency: 100 + urbanBonus + infrastructureBonus,
    urbanBonus,
    infrastructureBonus,
    produced: 0,
    shortage: false,
  };
}

/** Fixed-point work: preserve fractional efficiency without floating-point drift. */
export function productionBudget(
  base: number,
  level: number,
  efficiency: number,
  period: number,
): number {
  const rate = base * level * efficiency;
  return (
    Math.floor(((period + 1) * rate) / 100) - Math.floor((period * rate) / 100)
  );
}
