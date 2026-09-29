import { Execution, Game, Unit, UnitType } from "../game/Game";
import { TrainStationExecution } from "./TrainStationExecution";

/** Connects a point-placed Infrastructure building to nearby legacy rails. */
export class InfrastructureExecution implements Execution {
  private active = true;
  private game: Game;

  constructor(private infrastructure: Unit) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(): void {
    if (this.active && this.infrastructure.isActive()) this.connectNearby();
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private connectNearby(): void {
    if (
      this.game.config().strategicEconomy() &&
      !this.game.config().isReplay()
    ) {
      return;
    }

    const nearby = this.game.nearbyUnits(
      this.infrastructure.tile()!,
      this.game.config().trainStationMaxRange(),
      [UnitType.City, UnitType.Port, UnitType.Infrastructure],
    );

    if (!this.infrastructure.hasTrainStation()) {
      this.game.addExecution(
        new TrainStationExecution(this.infrastructure, true),
      );
    }
    for (const { unit } of nearby) {
      if (!unit.hasTrainStation()) {
        this.game.addExecution(new TrainStationExecution(unit));
      }
    }
  }
}
