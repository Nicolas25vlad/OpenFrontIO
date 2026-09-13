import {
  ECONOMY,
  INDUSTRIAL_RECIPES,
  NUCLEAR_RECIPE,
} from "../configuration/StrategyConfig";
import {
  consumeResources,
  hasResources,
  productionBudget,
  productionEfficiency,
} from "../game/Economy";
import { Execution, Game, Unit, UnitType } from "../game/Game";
import { ProcessedResource as Product } from "../game/Resources";

/** A building has one shared throughput budget, not a full budget per recipe. */
export class ProductionExecution implements Execution {
  private game: Game;
  private lastTick = -1;
  private recipeCursor = 0;

  constructor(private readonly building: Unit) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(ticks: number): void {
    if (
      !this.game.config().strategicEconomy() ||
      ticks === this.lastTick ||
      ticks % ECONOMY.periodTicks !== 0
    )
      return;
    this.lastTick = ticks;
    const unit = this.building;
    if (
      !unit.isActive() ||
      unit.isUnderConstruction() ||
      this.game.owner(unit.tile()) !== unit.owner()
    )
      return;
    const owner = unit.owner();
    const status = productionEfficiency(this.game, unit);
    const period = Math.floor(ticks / ECONOMY.periodTicks);
    if (unit.type() === UnitType.Farm) {
      const fertilized = consumeResources(owner, {
        [Product.Fertilizer]: unit.level(),
      });
      status.produced = productionBudget(
        fertilized ? ECONOMY.fertilizedFood : ECONOMY.farmFood,
        unit.level(),
        status.efficiency,
        period,
      );
      owner.addResource(Product.Food, status.produced);
      status.shortage = !fertilized;
    } else if (unit.type() === UnitType.NuclearPlant) {
      const budget = productionBudget(
        ECONOMY.nuclearBatches,
        unit.level(),
        status.efficiency,
        period,
      );
      for (let batch = 0; batch < budget; batch++) {
        if (!consumeResources(owner, NUCLEAR_RECIPE.inputs)) {
          status.shortage = true;
          break;
        }
        owner.addResource(Product.EnrichedUranium, NUCLEAR_RECIPE.amount);
        status.produced += NUCLEAR_RECIPE.amount;
      }
    } else if (unit.type() === UnitType.Factory) {
      const budget = productionBudget(
        ECONOMY.factoryBatches,
        unit.level(),
        status.efficiency,
        period,
      );
      for (let batch = 0; batch < budget; batch++) {
        let recipeIndex = -1;
        for (let offset = 0; offset < INDUSTRIAL_RECIPES.length; offset++) {
          const candidate =
            (this.recipeCursor + offset) % INDUSTRIAL_RECIPES.length;
          if (hasResources(owner, INDUSTRIAL_RECIPES[candidate].inputs)) {
            recipeIndex = candidate;
            break;
          }
        }
        if (recipeIndex < 0) {
          status.shortage = true;
          break;
        }
        const recipe = INDUSTRIAL_RECIPES[recipeIndex];
        consumeResources(owner, recipe.inputs);
        owner.addResource(recipe.output, recipe.amount);
        owner.addGold(ECONOMY.productionRevenue, unit.tile());
        status.produced += recipe.amount;
        this.recipeCursor = (recipeIndex + 1) % INDUSTRIAL_RECIPES.length;
      }
    }
    unit.setProductionStatus(status);
  }

  isActive(): boolean {
    return this.building.isActive();
  }
  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
