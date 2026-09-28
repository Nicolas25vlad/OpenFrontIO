import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { InfrastructureRouteExecution } from "./InfrastructureRouteExecution";

/** Nations automatically connect new supply centers to their capital station. */
export class SupplyCenterRouteExecution implements Execution {
  private game: Game;
  private active = true;

  constructor(
    private readonly player: Player,
    private readonly supplyCenter: Unit,
  ) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(): void {
    if (!this.supplyCenter.isActive()) {
      this.active = false;
      return;
    }
    if (this.supplyCenter.isUnderConstruction()) return;
    if (
      !this.game.railNetwork().stationManager().findStation(this.supplyCenter)
    ) {
      return;
    }

    const spawnTile = this.player.spawnTile();
    const capital = this.player
      .units(UnitType.City)
      .filter((city) => !city.isUnderConstruction())
      .sort((a, b) => {
        if (spawnTile === undefined) return a.id() - b.id();
        const distance = (unit: Unit) =>
          (this.game.x(unit.tile()) - this.game.x(spawnTile)) ** 2 +
          (this.game.y(unit.tile()) - this.game.y(spawnTile)) ** 2;
        return distance(a) - distance(b) || a.id() - b.id();
      })[0];
    if (!capital) {
      this.active = false;
      return;
    }

    this.game.addExecution(
      new InfrastructureRouteExecution(this.player, [
        capital.id(),
        this.supplyCenter.id(),
      ]),
    );
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
