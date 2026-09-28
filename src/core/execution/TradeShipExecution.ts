import { renderNumber } from "../../client/Utils";
import { NAVAL_TRADE } from "../configuration/StrategyConfig";
import {
  Execution,
  Game,
  MessageType,
  Player,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { ResourceType } from "../game/Resources";
import {
  nextWaterPathStagger,
  WaterPathFinder,
} from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { findClosestBy } from "../Util";

const pendingTradeShips = new WeakMap<Game, Set<TradeShipExecution>>();
const inTransitImports = new WeakMap<
  Game,
  Map<Player, Map<ResourceType, number>>
>();

function importReservations(game: Game, buyer: Player) {
  const buyers = inTransitImports.get(game) ?? new Map();
  inTransitImports.set(game, buyers);
  const reservations = buyers.get(buyer) ?? new Map<ResourceType, number>();
  buyers.set(buyer, reservations);
  return reservations;
}

export type StrategicCargoDecision =
  | {
      kind: "available";
      resource: ResourceType;
      amount: number;
      payment: bigint;
      shortage: number;
      target: number;
    }
  | {
      kind: "unavailable";
      reason:
        | "same-player"
        | "disabled"
        | "no-deficit"
        | "no-surplus"
        | "insufficient-funds"
        | "transaction-race";
    };

/** Pure cargo selection makes import/export decisions explicit and testable. */
export function selectStrategicCargo(
  seller: Player,
  buyer: Player,
  reservedImports?: ReadonlyMap<ResourceType, number>,
): StrategicCargoDecision {
  if (seller === buyer) return { kind: "unavailable", reason: "same-player" };

  const pricePerUnit = NAVAL_TRADE.cargoPricePerUnit;
  const affordableUnits = Number(buyer.gold() / pricePerUnit);
  let hasDeficit = false;
  let hasSurplus = false;
  let selected:
    | {
        resource: ResourceType;
        amount: number;
        shortage: number;
        target: number;
      }
    | undefined;

  for (const resource of NAVAL_TRADE.cargoOrder) {
    const target = NAVAL_TRADE.importTarget[resource];
    const shortage =
      target -
      buyer.resourceAmount(resource) -
      (reservedImports?.get(resource) ?? 0);
    if (shortage <= 0) continue;
    hasDeficit = true;

    const surplus =
      seller.resourceAmount(resource) - NAVAL_TRADE.exportReserve[resource];
    if (surplus <= 0) continue;
    hasSurplus = true;

    const amount = Math.min(
      NAVAL_TRADE.cargoUnits,
      shortage,
      surplus,
      affordableUnits,
    );
    if (amount <= 0) continue;

    // Prioritize the resource furthest below its configured import target.
    // Cross multiplication avoids floating-point ratios and keeps ties stable.
    if (
      selected === undefined ||
      shortage * selected.target > selected.shortage * target
    ) {
      selected = { resource, amount, shortage, target };
    }
  }

  if (selected === undefined) {
    return {
      kind: "unavailable",
      reason: !hasDeficit
        ? "no-deficit"
        : !hasSurplus
          ? "no-surplus"
          : "insufficient-funds",
    };
  }
  return {
    kind: "available",
    ...selected,
    payment: BigInt(selected.amount) * pricePerUnit,
  };
}

/** Queue a trade route and index its pending spawn without scanning all executions. */
export function addTradeShipExecution(
  game: Game,
  execution: TradeShipExecution,
): void {
  const pending = pendingTradeShips.get(game) ?? new Set<TradeShipExecution>();
  pending.add(execution);
  pendingTradeShips.set(game, pending);
  game.addExecution(execution);
}

/** Count pending route spawns for one game or player, pruning resolved routes. */
export function pendingTradeShipCount(game: Game, owner?: Player): number {
  const pending = pendingTradeShips.get(game);
  if (pending === undefined) return 0;

  let count = 0;
  for (const execution of pending) {
    if (!execution.isActive() || execution.hasSpawnedShip()) {
      pending.delete(execution);
      continue;
    }
    if (owner === undefined || execution.originatingPlayer() === owner) count++;
  }
  return count;
}

export class TradeShipExecution implements Execution {
  private active = true;
  private mg: Game;
  private tradeShip: Unit | undefined;
  private wasCaptured = false;
  private pathFinder: WaterPathFinder;
  private tilesTraveled = 0;
  private motionPlanId = 1;
  private motionPlanDst: TileRef | null = null;
  private cargo?: {
    resource: ResourceType;
    amount: number;
    buyer: Player;
    payment: bigint;
  };
  private cargoDecision?: StrategicCargoDecision;

  constructor(
    private origOwner: Player,
    private srcPort: Unit,
    private _dstPort: Unit,
    private readonly requireStrategicCargo = false,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const pending = pendingTradeShips.get(mg) ?? new Set<TradeShipExecution>();
    pending.add(this);
    pendingTradeShips.set(mg, pending);
    const stagger = nextWaterPathStagger(mg);
    this.pathFinder = new WaterPathFinder(mg, stagger, true); // memoized: port tile to port tile repeats
  }

  tick(ticks: number): void {
    if (this.pathFinder.rebuilt) {
      this.motionPlanDst = null; // Force motion plan re-recording
    }

    if (this.tradeShip === undefined) {
      const spawn = this.origOwner.canBuild(
        UnitType.TradeShip,
        this.srcPort.tile(),
      );
      if (spawn === false) {
        console.warn(`cannot build trade ship`);
        this.active = false;
        return;
      }
      this.tradeShip = this.origOwner.buildUnit(UnitType.TradeShip, spawn, {
        targetUnit: this._dstPort,
        lastSetSafeFromPirates: ticks,
      });
      this.loadStrategicCargo(this.origOwner, this._dstPort.owner());
      if (this.requireStrategicCargo && this.cargo === undefined) {
        this.tradeShip.delete(false);
        this.active = false;
        return;
      }
      this.mg.stats().boatSendTrade(this.origOwner, this._dstPort.owner());
    }

    if (!this.tradeShip.isActive()) {
      this.refundBuyerForLostCargo();
      this.active = false;
      return;
    }

    const tradeShipOwner = this.tradeShip.owner();
    const dstPortOwner = this._dstPort.owner();
    if (this.wasCaptured !== true && this.origOwner !== tradeShipOwner) {
      // Store as variable in case ship is recaptured by previous owner
      this.wasCaptured = true;
      this.mg.displayMessage(
        "events_display.trade_ship_captured",
        MessageType.UNIT_DESTROYED,
        this.origOwner.id(),
        undefined,
        { name: tradeShipOwner.displayName() },
        this.tradeShip.id(),
        tradeShipOwner.id(),
      );
    }

    // If a player captures another player's port while trading we should delete
    // the ship.
    if (dstPortOwner.id() === this.srcPort.owner().id()) {
      this.refundCargo();
      this.tradeShip.delete(false);
      this.active = false;
      return;
    }

    if (
      !this.wasCaptured &&
      (!this._dstPort.isActive() || !tradeShipOwner.canTrade(dstPortOwner))
    ) {
      this.refundCargo();
      this.tradeShip.delete(false);
      this.active = false;
      return;
    }

    const curTile = this.tradeShip.tile();

    if (
      this.wasCaptured &&
      (tradeShipOwner !== dstPortOwner || !this._dstPort.isActive())
    ) {
      const myComponent = this.mg.getWaterComponent(curTile);
      const nearestPort = findClosestBy(
        tradeShipOwner.units(UnitType.Port),
        (port) => this.mg.manhattanDist(port.tile(), curTile),
        (port) =>
          port.isActive() &&
          !port.isMarkedForDeletion() &&
          !port.isUnderConstruction() &&
          myComponent !== null &&
          this.mg.hasWaterComponent(port.tile(), myComponent),
      );
      if (nearestPort === null) {
        this.refundBuyerForLostCargo();
        this.tradeShip.delete(false);
        this.active = false;
        return;
      } else {
        this._dstPort = nearestPort;
        this.tradeShip.setTargetUnit(this._dstPort);
        // Plan-driven units don't emit per-tick unit updates, so force a sync for the new target.
        this.tradeShip.touch();
      }
    }

    if (curTile === this.dstPort()) {
      this.complete();
      return;
    }

    const dst = this._dstPort.tile();
    const result = this.pathFinder.next(curTile, dst);

    switch (result.status) {
      case PathStatus.NEXT:
        if (dst !== this.motionPlanDst) {
          this.motionPlanId++;
          const from = result.node;
          const path = this.pathFinder.pathForTraversal(from, dst);

          this.mg.recordMotionPlan({
            kind: "grid",
            unitId: this.tradeShip.id(),
            planId: this.motionPlanId,
            startTick: ticks + 1,
            ticksPerStep: 1,
            path,
          });
          this.motionPlanDst = dst;
        }
        // Update safeFromPirates status
        if (this.mg.isWater(result.node) && this.mg.isShoreline(result.node)) {
          this.tradeShip.setSafeFromPirates();
        }
        this.tradeShip.move(result.node);
        this.tilesTraveled++;
        break;
      case PathStatus.COMPLETE:
        this.complete();
        return;
      case PathStatus.NOT_FOUND:
        console.warn("captured trade ship cannot find route");
        this.refundCargo();
        if (this.tradeShip.isActive()) {
          this.tradeShip.delete(false);
        }
        this.active = false;
        return;
    }
  }

  private complete() {
    this.active = false;
    this.tradeShip!.delete(false);
    const gold = this.mg
      .config()
      .tradeShipGold(this.tilesTraveled, this.tradeShip!.owner());

    if (this.wasCaptured) {
      this.tradeShip!.owner().addGold(gold, this._dstPort.tile());
      this.tradeShip!.owner().addPiracyGold(gold);
      this.mg.displayMessage(
        "events_display.received_gold_from_captured_ship",
        MessageType.CAPTURED_ENEMY_UNIT,
        this.tradeShip!.owner().id(),
        gold,
        {
          gold: renderNumber(gold),
          name: this.origOwner.displayName(),
        },
        undefined,
        this.origOwner.id(),
      );
      // Record stats
      this.mg
        .stats()
        .boatCapturedTrade(this.tradeShip!.owner(), this.origOwner, gold);
    } else {
      this.srcPort.owner().addGold(gold, this.srcPort.tile());
      this._dstPort.owner().addGold(gold, this._dstPort.tile());
      this.srcPort.owner().addTradeGold(gold);
      this._dstPort.owner().addTradeGold(gold);
      // Record stats
      this.mg
        .stats()
        .boatArriveTrade(this.srcPort.owner(), this._dstPort.owner(), gold);
    }
    if (this.cargo) {
      this._dstPort.owner().addResource(this.cargo.resource, this.cargo.amount);
      if (this.wasCaptured) {
        // A captured convoy delivers its cargo to the captor's port, while
        // the original buyer gets its escrow back.
        this.cargo.buyer.addGold(this.cargo.payment);
      } else {
        this.origOwner.addGold(this.cargo.payment);
      }
      this.releaseCargoReservation();
      this.cargo = undefined;
    }
    return;
  }

  private loadStrategicCargo(seller: Player, buyer: Player): void {
    if (!this.mg.config().strategicEconomy()) {
      this.cargoDecision = { kind: "unavailable", reason: "disabled" };
      return;
    }
    const decision = selectStrategicCargo(
      seller,
      buyer,
      importReservations(this.mg, buyer),
    );
    this.cargoDecision = decision;
    if (decision.kind !== "available") return;

    const removed = seller.removeResource(decision.resource, decision.amount);
    const paid = buyer.removeGold(decision.payment);
    if (removed !== decision.amount || paid !== decision.payment) {
      if (removed > 0) seller.addResource(decision.resource, removed);
      if (paid > 0n) buyer.addGold(paid);
      this.cargoDecision = {
        kind: "unavailable",
        reason: "transaction-race",
      };
      return;
    }
    this.cargo = {
      resource: decision.resource,
      amount: decision.amount,
      buyer,
      payment: decision.payment,
    };
    const reservations = importReservations(this.mg, buyer);
    reservations.set(
      decision.resource,
      (reservations.get(decision.resource) ?? 0) + decision.amount,
    );
  }

  private refundCargo(): void {
    if (!this.cargo) return;
    this.origOwner.addResource(this.cargo.resource, this.cargo.amount);
    this.cargo.buyer.addGold(this.cargo.payment);
    this.releaseCargoReservation();
    this.cargo = undefined;
  }

  private refundBuyerForLostCargo(): void {
    if (!this.cargo) return;
    this.cargo.buyer.addGold(this.cargo.payment);
    this.releaseCargoReservation();
    this.cargo = undefined;
  }

  private releaseCargoReservation(): void {
    if (!this.cargo) return;
    const reservations = importReservations(this.mg, this.cargo.buyer);
    const remaining =
      (reservations.get(this.cargo.resource) ?? 0) - this.cargo.amount;
    if (remaining > 0) reservations.set(this.cargo.resource, remaining);
    else reservations.delete(this.cargo.resource);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  dstPort(): TileRef {
    return this._dstPort.tile();
  }

  originatingPlayer(): Player {
    return this.origOwner;
  }

  hasSpawnedShip(): boolean {
    return this.tradeShip !== undefined;
  }

  strategicCargoDecision(): StrategicCargoDecision | undefined {
    return this.cargoDecision;
  }
}

/** Counts active ships and route executions that have not spawned their ship. */
export function activeTradeRouteCount(game: Game): number {
  return game.unitCount(UnitType.TradeShip) + pendingTradeShipCount(game);
}
