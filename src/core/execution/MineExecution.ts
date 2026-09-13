import { ECONOMY } from "../configuration/StrategyConfig";
import { productionBudget, productionEfficiency } from "../game/Economy";
import { Execution, Game, Unit } from "../game/Game";

export class MineExecution implements Execution {
  private game: Game;
  private lastTick = -1;

  constructor(private readonly mine: Unit) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(ticks: number): void {
    if (ticks === this.lastTick || ticks % ECONOMY.periodTicks !== 0) return;
    this.lastTick = ticks;
    if (
      !this.mine.isActive() ||
      this.mine.isUnderConstruction() ||
      this.game.owner(this.mine.tile()) !== this.mine.owner()
    )
      return;
    const status = productionEfficiency(this.game, this.mine);
    const deposits = this.game.resourceDepositsAt(this.mine.tile());
    for (const node of deposits) {
      const extracted = this.game.extractResource(
        this.mine.tile(),
        productionBudget(
          node.richness * ECONOMY.mineOutputPerRichness,
          this.mine.level(),
          status.efficiency,
          Math.floor(ticks / ECONOMY.periodTicks),
        ),
        node.resource,
      );
      this.mine.owner().addResource(node.resource, extracted);
      status.produced += extracted;
    }
    status.exhausted = deposits.every(
      (node) =>
        this.game.resourceRemaining(this.mine.tile(), node.resource) === 0,
    );
    this.mine.setProductionStatus(status);
  }

  isActive(): boolean {
    return this.mine.isActive();
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
