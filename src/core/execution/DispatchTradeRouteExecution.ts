import { NAVAL_TRADE } from "../configuration/StrategyConfig";
import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { isNavalSectorBlockaded } from "../game/NavalSupremacy";
import { TradeShipExecution } from "./TradeShipExecution";

/** Validates a player-selected port pair and starts one authoritative convoy. */
export class DispatchTradeRouteExecution implements Execution {
  private active = true;
  private game: Game;
  private source: Unit | undefined;
  private destination: Unit | undefined;

  constructor(
    private readonly owner: Player,
    private readonly sourcePortID: number,
    private readonly destinationPortID: number,
  ) {}

  init(game: Game, _ticks: number): void {
    this.game = game;
    this.source = game.unit(this.sourcePortID);
    this.destination = game.unit(this.destinationPortID);
    if (!this.isValidRoute(game, this.source, this.destination)) {
      this.active = false;
    }
  }

  tick(_ticks: number): void {
    if (!this.active) return;
    this.active = false;
    if (!this.isValidRoute(this.game, this.source, this.destination)) return;
    this.game.addExecution(
      new TradeShipExecution(this.owner, this.source!, this.destination!),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private isValidRoute(
    game: Game,
    source: Unit | undefined,
    destination: Unit | undefined,
  ): source is Unit {
    if (
      !game.config().strategicEconomy() ||
      game.config().isUnitDisabled(UnitType.TradeShip) ||
      source === undefined ||
      destination === undefined ||
      source.type() !== UnitType.Port ||
      destination.type() !== UnitType.Port ||
      !source.isActive() ||
      source.isUnderConstruction() ||
      source.isMarkedForDeletion() ||
      !destination.isActive() ||
      destination.isUnderConstruction() ||
      destination.isMarkedForDeletion() ||
      source.owner() !== this.owner ||
      !this.owner.canTrade(destination.owner()) ||
      source === destination ||
      !this.hasRouteCapacity(game) ||
      isNavalSectorBlockaded(game, destination) ||
      this.owner.canBuild(UnitType.TradeShip, source.tile()) === false
    ) {
      return false;
    }

    const sourceComponents = new Set<number>();
    const neighbors: TileRef[] = [];
    const neighborCount = game.neighbors4(source.tile(), neighbors);
    for (let index = 0; index < neighborCount; index++) {
      const neighbor = neighbors[index];
      if (!game.isWater(neighbor)) continue;
      const component = game.getWaterComponent(neighbor);
      if (component !== null) sourceComponents.add(component);
    }
    for (const component of sourceComponents) {
      if (game.hasWaterComponent(destination.tile(), component)) return true;
    }
    return false;
  }

  private hasRouteCapacity(game: Game): boolean {
    const executions = game.executions?.() ?? [];
    const thisIndex = executions.indexOf(this);
    const earlierRequests = executions
      .slice(0, thisIndex < 0 ? 0 : thisIndex)
      .filter(
        (execution) =>
          execution instanceof DispatchTradeRouteExecution &&
          execution.owner === this.owner &&
          execution.isActive(),
      ).length;
    const pendingTradeShips = executions.filter(
      (execution) =>
        execution instanceof TradeShipExecution &&
        execution.isActive() &&
        execution.originatingPlayer() === this.owner &&
        !execution.hasSpawnedShip(),
    ).length;
    return (
      this.owner.units(UnitType.TradeShip).length +
        pendingTradeShips +
        earlierRequests <
      NAVAL_TRADE.manualRouteLimitPerPlayer
    );
  }
}
