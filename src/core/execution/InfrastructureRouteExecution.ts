import { Execution, Game, Player, Unit } from "../game/Game";
import { ProcessedResource } from "../game/Resources";

/** Validates and commits a player-selected route between logistics buildings. */
export class InfrastructureRouteExecution implements Execution {
  private game: Game;
  private active = true;

  constructor(
    private readonly player: Player,
    private readonly unitIds: number[],
  ) {}

  init(game: Game): void {
    this.game = game;
  }

  tick(): void {
    this.active = false;
    if (!this.game.config().strategicEconomy()) {
      return this.reject("strategic logistics are disabled");
    }
    const routeConfig = this.game.config().infrastructureRoute();
    if (
      this.unitIds.length < routeConfig.minNodes ||
      this.unitIds.length > routeConfig.maxNodes ||
      new Set(this.unitIds).size !== this.unitIds.length
    ) {
      return this.reject("route node count or ids are invalid");
    }

    const units: Unit[] = [];
    for (const id of this.unitIds) {
      const unit = this.game.unit(id);
      if (
        !unit ||
        unit.owner() !== this.player ||
        !unit.isActive() ||
        unit.isUnderConstruction() ||
        unit.info().logisticsNode !== true
      ) {
        return this.reject(
          `unit ${id} is unavailable or not logistics-compatible`,
        );
      }
      units.push(unit);
    }

    const network = this.game.railNetwork();
    const paths = network.planInfrastructureRoute(units);
    if (paths === null)
      return this.reject("no valid rail path between route nodes");

    const stations = network.stationManager();
    let buildTiles = 0;
    for (let i = 0; i < paths.length; i++) {
      const from = stations.findStation(units[i]);
      const to = stations.findStation(units[i + 1]);
      if (from?.getRailroadTo(to!) === null || from === null || to === null) {
        buildTiles += paths[i].length;
      }
    }
    const goldCost = this.game
      .config()
      .infrastructureRouteGoldCost(buildTiles, this.player);
    const steelCost = Math.ceil(buildTiles / routeConfig.steelPerTiles);
    if (this.player.gold() < goldCost) {
      return this.reject(`insufficient gold: requires ${goldCost}`);
    }
    if (this.player.resourceAmount(ProcessedResource.Steel) < steelCost) {
      return this.reject(`insufficient steel: requires ${steelCost}`);
    }

    if (goldCost > 0n) this.player.removeGold(goldCost);
    if (steelCost > 0)
      this.player.removeResource(ProcessedResource.Steel, steelCost);
    if (!network.connectInfrastructureRoute(units, paths)) {
      // Plans are revalidated immediately above; this signals an internal invariant violation.
      throw new Error("validated infrastructure route could not be committed");
    }
    console.debug(
      `Infrastructure route built for ${this.player.name()}: ${units.length} nodes, ${buildTiles} tiles, ${goldCost} gold, ${steelCost} steel`,
    );
  }

  private reject(reason: string): void {
    console.warn(
      `Infrastructure route rejected for ${this.player.name()}: ${reason}`,
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
