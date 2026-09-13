import { Execution, Game, Unit, UnitType } from "../game/Game";
import { TrainStationExecution } from "./TrainStationExecution";

export class FactoryExecution implements Execution {
  private active: boolean = true;
  private game: Game;

  constructor(private factory: Unit) {}

  init(mg: Game, ticks: number): void {
    this.game = mg;
  }

  tick(ticks: number): void {
    if (this.active && this.factory.isActive()) this.createStation();
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private createStation(): void {
    const strategicEconomy = this.game.config().strategicEconomy();
    const structures = this.game.nearbyUnits(
      this.factory.tile()!,
      this.game.config().trainStationMaxRange(),
      [UnitType.City, UnitType.Port, UnitType.Factory, UnitType.Infrastructure],
    );

    // Preserve the legacy overlapping-station behavior for archived and
    // non-strategic games; strategic games use one non-spawning station per
    // structure so factories do not create duplicate train spawners.
    if (!strategicEconomy) {
      this.game.addExecution(
        new TrainStationExecution(this.factory, true),
      );
      for (const { unit } of structures) {
        if (!unit.hasTrainStation()) {
          this.game.addExecution(new TrainStationExecution(unit));
        }
      }
      return;
    }

    if (!this.factory.hasTrainStation())
      this.game.addExecution(new TrainStationExecution(this.factory));
    for (const { unit } of structures) {
      if (!unit.hasTrainStation()) {
        this.game.addExecution(new TrainStationExecution(unit));
      }
    }
  }
}
