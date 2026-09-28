import { STRATEGIC_COMBAT } from "../configuration/StrategyConfig";
import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

interface TankOrder {
  unit: Unit;
  path: TileRef[];
  nextStep: number;
  elapsedTicks: number;
  allowHostileTraversal: boolean;
}

const ACTIVE_TANK_ORDERS = new WeakMap<Unit, MoveTankExecution>();

/** Moves independent tanks over passable land and resolves each assault tile. */
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
    if (!mg.isValidRef(this.destination)) return;
    const allowHostileTraversal = mg.owner(this.destination) !== this.player;
    if (!this.isPassableLand(mg, this.destination, allowHostileTraversal)) {
      return;
    }

    const tanks = new Map(
      this.player.units(UnitType.Tank).map((tank) => [tank.id(), tank]),
    );
    const paths = this.findPathsTo(mg, this.destination, allowHostileTraversal);
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
        allowHostileTraversal,
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
        !this.isPassableLand(
          this.game,
          nextTile,
          order.allowHostileTraversal,
        ) ||
        !this.isPassableLand(
          this.game,
          order.unit.tile(),
          order.allowHostileTraversal,
        )
      ) {
        this.finishOrder(order.unit);
        this.orders.delete(unitID);
        continue;
      }

      const tankCombat = this.resolveTankCombat(
        this.game,
        order.unit,
        nextTile,
      );
      if (tankCombat === "blocked") {
        this.finishOrder(order.unit);
        this.orders.delete(unitID);
        continue;
      }
      if (tankCombat === "fighting") {
        if (!order.unit.isActive()) {
          this.orders.delete(unitID);
        }
        continue;
      }

      const previousOwner = this.game.owner(nextTile);
      if (previousOwner !== this.player) {
        this.resolveTerritoryCombat(this.game, order.unit, nextTile);
        if (!order.unit.isActive()) {
          this.orders.delete(unitID);
          continue;
        }
        this.player.conquer(nextTile);
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

  private findPathsTo(
    mg: Game,
    destination: TileRef,
    allowHostileTraversal: boolean,
  ): Int32Array {
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
            !this.isPassableLand(mg, neighbor, allowHostileTraversal)
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

  private isPassableLand(
    mg: Game,
    tile: TileRef,
    allowHostileTraversal: boolean,
  ): boolean {
    if (!mg.isLand(tile) || mg.isImpassable(tile)) return false;
    const owner = mg.owner(tile);
    return (
      owner === this.player ||
      (allowHostileTraversal &&
        (!owner.isPlayer() ||
          (!this.player.isFriendly(owner) &&
            this.player.canAttackPlayer(owner))))
    );
  }

  private resolveTankCombat(
    mg: Game,
    attacker: Unit,
    tile: TileRef,
  ): "clear" | "fighting" | "blocked" {
    const defender = mg
      .units(UnitType.Tank)
      .find(
        (tank) =>
          tank.isActive() &&
          tank.tile() === tile &&
          tank.id() !== attacker.id(),
      );
    if (!defender) return "clear";
    if (
      defender.owner() === this.player ||
      this.player.isFriendly(defender.owner()) ||
      !this.player.canAttackPlayer(defender.owner())
    ) {
      return "blocked";
    }

    const damage = STRATEGIC_COMBAT.tankUnitCombatDamage;
    defender.modifyHealth(-damage, this.player);
    if (defender.isActive() && attacker.isActive()) {
      attacker.modifyHealth(-damage, defender.owner());
    }
    return defender.isActive() ? "fighting" : "clear";
  }

  private resolveTerritoryCombat(mg: Game, tank: Unit, tile: TileRef): void {
    const owner = mg.owner(tile);
    const defender = owner.isPlayer() ? owner : null;
    const defensePost = defender
      ? mg.highestLevelUnitNearby(
          tile,
          mg.config().defensePostRange(),
          UnitType.DefensePost,
          defender.id(),
        )
      : undefined;
    const result = mg.config().attackLogic({
      terrain: mg.terrainType(tile),
      attackTroops: STRATEGIC_COMBAT.tankCombatPower,
      attacker: {
        type: this.player.type(),
        numTiles: this.player.numTilesOwned(),
        supply: this.player.supplyStatus().infantry,
        logistics: this.player.supplyStatus().logistics,
        tanks: 1,
      },
      defender: defender
        ? {
            type: defender.type(),
            numTiles: defender.numTilesOwned(),
            troops: defender.troops(),
            supply: defender.supplyStatus().infantry,
            isTraitor: defender.isTraitor(),
            isDisconnectedTeammate:
              defender.isDisconnected() && this.player.isOnSameTeam(defender),
          }
        : null,
      defenderHasDefensePost: defensePost !== undefined,
      defenderDefensePostLevel: defensePost?.level() ?? 0,
      defenderTrenchLevel: mg.trenchLevel(tile),
      falloutRatio: mg.hasFallout(tile)
        ? mg.numTilesWithFallout() / mg.numLandTiles()
        : null,
      borderSize: 1,
    });

    if (defender) defender.removeTroops(result.defenderTroopLoss);
    const tankDamage = Math.ceil(
      (result.attackerTroopLoss *
        tank.maxHealth() *
        STRATEGIC_COMBAT.tankCasualtyMultiplier) /
        STRATEGIC_COMBAT.tankCombatPower,
    );
    if (tankDamage > 0) tank.modifyHealth(-tankDamage, defender ?? undefined);
    if (
      defensePost &&
      mg.config().strategicEconomy() &&
      defensePost.isActive()
    ) {
      defensePost.modifyHealth(
        -STRATEGIC_COMBAT.defensePostWearPerTile,
        this.player,
      );
    }
    if (mg.config().strategicEconomy()) {
      const trenchLevel = mg.trenchLevel(tile);
      if (trenchLevel > 0) {
        mg.setTrenchLevel(
          tile,
          Math.max(0, trenchLevel - STRATEGIC_COMBAT.trenchWearPerResolvedTile),
        );
      }
    }
  }
}
