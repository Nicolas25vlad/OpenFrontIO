import { STRATEGIC_COMBAT } from "../configuration/StrategyConfig";
import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

interface TankOrder {
  unit: Unit;
  path: TileRef[];
  nextStep: number;
  elapsedTicks: number;
}

const ACTIVE_TANK_ORDERS = new WeakMap<Unit, MoveTankExecution>();

/** Moves independently deployed tanks across their owner's passable land. */
export class MoveTankExecution implements Execution {
  private orders = new Map<number, TankOrder>();
  private game: Game | null = null;

  constructor(
    private readonly player: Player,
    private readonly unitIds: readonly number[],
    private readonly destination: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.game = mg;
    if (
      !mg.isValidRef(this.destination) ||
      !this.isOwnedPassableLand(mg, this.destination)
    ) {
      return;
    }

    const tanks = new Map(
      this.player.units(UnitType.Tank).map((tank) => [tank.id(), tank]),
    );
    const paths = this.findPathsTo(mg, this.destination);
    for (const unitID of new Set(this.unitIds)) {
      const tank = tanks.get(unitID);
      if (!tank?.isActive()) continue;

      const path = this.pathFromSource(paths, tank.tile());
      if (path === null) continue;

      const currentOrder = ACTIVE_TANK_ORDERS.get(tank);
      if (currentOrder !== undefined) currentOrder.cancelTankOrder(tank);
      ACTIVE_TANK_ORDERS.set(tank, this);
      tank.setTargetTile(this.destination);
      tank.touch();
      this.orders.set(tank.id(), {
        unit: tank,
        path,
        nextStep: 1,
        elapsedTicks: 0,
      });
    }
  }

  tick(_ticks: number): void {
    for (const [unitID, order] of this.orders) {
      if (
        ACTIVE_TANK_ORDERS.get(order.unit) !== this ||
        !order.unit.isActive() ||
        order.unit.targetTile() !== this.destination
      ) {
        this.orders.delete(unitID);
        continue;
      }

      order.elapsedTicks++;
      if (order.elapsedTicks < STRATEGIC_COMBAT.tankMoveTicksPerTile) continue;
      order.elapsedTicks = 0;

      const nextTile = order.path[order.nextStep];
      if (nextTile === undefined) {
        this.finishOrder(order.unit);
        this.orders.delete(unitID);
        continue;
      }

      if (
        this.game === null ||
        !this.isOwnedPassableLand(this.game, nextTile)
      ) {
        this.finishOrder(order.unit);
        this.orders.delete(unitID);
        continue;
      }

      order.unit.move(nextTile);
      order.nextStep++;
      if (order.nextStep >= order.path.length) {
        this.finishOrder(order.unit);
        this.orders.delete(unitID);
      }
    }
  }

  isActive(): boolean {
    return this.orders.size > 0;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  cancelTankOrder(tank: Unit): void {
    const order = this.orders.get(tank.id());
    if (!order) return;
    this.orders.delete(tank.id());
    if (ACTIVE_TANK_ORDERS.get(tank) === this) {
      ACTIVE_TANK_ORDERS.delete(tank);
      tank.setTargetTile(undefined);
      tank.touch();
    }
  }

  private finishOrder(tank: Unit): void {
    if (ACTIVE_TANK_ORDERS.get(tank) !== this) return;
    ACTIVE_TANK_ORDERS.delete(tank);
    tank.setTargetTile(undefined);
    tank.touch();
  }

  private findPathsTo(mg: Game, destination: TileRef): Int32Array {
    const tileCount = mg.width() * mg.height();
    const nextTile = new Int32Array(tileCount);
    nextTile.fill(-2);
    const queue = new Int32Array(tileCount);
    let head = 0;
    let tail = 1;
    let layerEnd = 1;
    let distance = 0;
    queue[0] = destination;
    nextTile[destination] = -1;

    while (head < tail && distance < STRATEGIC_COMBAT.tankMaxMovementRange) {
      while (head < layerEnd) {
        const current = queue[head++];
        mg.forEachNeighbor(current, (neighbor) => {
          if (
            nextTile[neighbor] !== -2 ||
            !this.isOwnedPassableLand(mg, neighbor)
          ) {
            return;
          }
          nextTile[neighbor] = current;
          queue[tail++] = neighbor;
        });
      }
      layerEnd = tail;
      distance++;
    }
    return nextTile;
  }

  private pathFromSource(
    nextTile: Int32Array,
    source: TileRef,
  ): TileRef[] | null {
    if (source < 0 || source >= nextTile.length || nextTile[source] === -2) {
      return null;
    }
    const path: TileRef[] = [];
    for (
      let tile = source;
      tile >= 0 && path.length <= STRATEGIC_COMBAT.tankMaxMovementRange + 1;
      tile = nextTile[tile]
    ) {
      path.push(tile);
      if (nextTile[tile] === -1) break;
    }
    if (
      path[path.length - 1] !== this.destination ||
      path.length - 1 > STRATEGIC_COMBAT.tankMaxMovementRange
    ) {
      return null;
    }
    return path;
  }

  private isOwnedPassableLand(mg: Game, tile: TileRef): boolean {
    return (
      mg.ownerID(tile) === this.player.smallID() &&
      mg.isLand(tile) &&
      !mg.isImpassable(tile)
    );
  }
}
