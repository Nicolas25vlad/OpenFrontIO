import { NAVAL_TRADE } from "../configuration/StrategyConfig";
import { Execution, Game, Unit, UnitType } from "../game/Game";
import { isNavalSectorBlockaded } from "../game/NavalSupremacy";
import { PseudoRandom } from "../PseudoRandom";
import {
  activeTradeRouteCount,
  addTradeShipExecution,
  selectStrategicCargo,
  TradeShipExecution,
} from "./TradeShipExecution";
import { TrainStationExecution } from "./TrainStationExecution";

export class PortExecution implements Execution {
  private active = true;
  private mg: Game;
  private port: Unit;
  private random: PseudoRandom;
  private checkOffset: number;
  private tradeShipSpawnRejections = 0;

  constructor(port: Unit) {
    this.port = port;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks());
    this.checkOffset = mg.ticks() % 10;
  }

  tick(ticks: number): void {
    if (this.mg === null || this.random === null || this.checkOffset === null) {
      throw new Error("Not initialized");
    }

    if (!this.port.isActive()) {
      this.active = false;
      return;
    }

    if (this.port.isUnderConstruction()) {
      return;
    }

    if (!this.port.hasTrainStation()) {
      this.createStation();
    }

    // Only check every 10 ticks for performance.
    if ((this.mg.ticks() + this.checkOffset) % 10 !== 0) {
      return;
    }

    if (!this.shouldSpawnTradeShip()) {
      return;
    }

    if (this.mg.config().strategicEconomy()) {
      const supplier = this.supplierPorts()[0];
      if (supplier === undefined) return;
      addTradeShipExecution(
        this.mg,
        new TradeShipExecution(supplier.owner(), supplier, this.port, true),
      );
      return;
    }

    const destination = this.random.randElement(this.tradingPorts());
    if (destination === undefined) return;
    addTradeShipExecution(
      this.mg,
      new TradeShipExecution(this.port.owner(), this.port, destination),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  shouldSpawnTradeShip(): boolean {
    if (
      this.mg.config().strategicEconomy() &&
      activeTradeRouteCount(this.mg) >= NAVAL_TRADE.globalRouteLimit
    ) {
      return false;
    }
    const numTradeShips = this.mg.unitCount(UnitType.TradeShip);
    for (let i = 0; i < this.port!.level(); i++) {
      const spawnRate = this.mg
        .config()
        .tradeShipSpawnRate(this.tradeShipSpawnRejections, numTradeShips);
      if (this.random.chance(spawnRate)) {
        this.tradeShipSpawnRejections = 0;
        return true;
      }
      this.tradeShipSpawnRejections++;
    }
    return false;
  }

  createStation(): void {
    const nearbyFactory = this.mg.hasUnitNearby(
      this.port.tile()!,
      this.mg.config().trainStationMaxRange(),
      UnitType.Factory,
    );
    if (
      nearbyFactory ||
      this.mg.hasUnitNearby(
        this.port.tile(),
        this.mg.config().trainStationMaxRange(),
        UnitType.Infrastructure,
      )
    ) {
      this.mg.addExecution(new TrainStationExecution(this.port));
    }
  }

  // It's a probability list, so if an element appears twice it's because it's
  // twice more likely to be picked later.
  tradingPorts(): Unit[] {
    const sourceComponents = new Set<number>();
    for (const neighbor of this.mg.neighbors(this.port!.tile())) {
      if (!this.mg.isWater(neighbor)) continue;
      const comp = this.mg.getWaterComponent(neighbor);
      if (comp !== null) sourceComponents.add(comp);
    }
    const ports = this.mg
      .players()
      .filter((p) => p !== this.port!.owner() && p.canTrade(this.port!.owner()))
      .flatMap((p) => p.units(UnitType.Port))
      .filter((p) => {
        for (const comp of sourceComponents) {
          if (this.mg.hasWaterComponent(p.tile(), comp)) return true;
        }
        return false;
      })
      .filter(
        (port) =>
          !this.mg.config().strategicEconomy() ||
          selectStrategicCargo(this.port!.owner(), port.owner()).kind ===
            "available",
      )
      .filter(
        (port) =>
          !this.mg.config().strategicEconomy() ||
          !isNavalSectorBlockaded(this.mg, port),
      )
      .sort((p1, p2) => {
        const owner = this.port!.owner();
        const p1Allied = owner.isAlliedWith(p1.owner()) ? 1 : 0;
        const p2Allied = owner.isAlliedWith(p2.owner()) ? 1 : 0;
        if (p1Allied !== p2Allied) return p2Allied - p1Allied;
        const p1Friendly = owner.isFriendly(p1.owner()) ? 1 : 0;
        const p2Friendly = owner.isFriendly(p2.owner()) ? 1 : 0;
        if (p1Friendly !== p2Friendly) return p2Friendly - p1Friendly;
        const relationDiff =
          p2.owner().relation(owner) - p1.owner().relation(owner);
        if (relationDiff !== 0) return relationDiff;
        const proximityDiff =
          this.mg.manhattanDist(this.port!.tile(), p1.tile()) -
          this.mg.manhattanDist(this.port!.tile(), p2.tile());
        if (proximityDiff !== 0) return proximityDiff;
        if (this.mg.config().strategicEconomy()) {
          const p1Cargo = selectStrategicCargo(owner, p1.owner());
          const p2Cargo = selectStrategicCargo(owner, p2.owner());
          const p1Available = p1Cargo.kind === "available" ? p1Cargo.amount : 0;
          const p2Available = p2Cargo.kind === "available" ? p2Cargo.amount : 0;
          if (p1Available !== p2Available) return p2Available - p1Available;
        }
        return p2.level() - p1.level();
      });

    const weightedPorts: Unit[] = [];

    for (const [i, otherPort] of ports.entries()) {
      const expanded = new Array(otherPort.level()).fill(otherPort);
      weightedPorts.push(...expanded);
      const tooClose =
        this.mg.manhattanDist(this.port!.tile(), otherPort.tile()) <
        this.mg.config().tradeShipShortRangeDebuff();
      const closeBonus =
        i < this.mg.config().proximityBonusPortsNb(ports.length);
      if (!tooClose && closeBonus) {
        // If the port is close, but not too close, add it again
        // to increase the chances of trading with it.
        weightedPorts.push(...expanded);
      }
      if (!tooClose && this.port!.owner().isFriendly(otherPort.owner())) {
        weightedPorts.push(...expanded);
      }
    }
    return weightedPorts;
  }

  /** Best eligible supplier for this importing port, with explicit priorities. */
  supplierPorts(): Unit[] {
    const buyer = this.port.owner();
    if (
      !this.mg.config().strategicEconomy() ||
      !this.port.isActive() ||
      this.port.isUnderConstruction() ||
      isNavalSectorBlockaded(this.mg, this.port)
    ) {
      return [];
    }

    const destinationComponents = new Set<number>();
    for (const neighbor of this.mg.neighbors(this.port.tile())) {
      if (!this.mg.isWater(neighbor)) continue;
      const component = this.mg.getWaterComponent(neighbor);
      if (component !== null) destinationComponents.add(component);
    }

    return this.mg
      .players()
      .filter((seller) => buyer.canTrade(seller))
      .flatMap((seller) => seller.units(UnitType.Port))
      .filter((source) => {
        if (
          !source.isActive() ||
          source.isUnderConstruction() ||
          source.isMarkedForDeletion() ||
          isNavalSectorBlockaded(this.mg, source) ||
          source.owner().canBuild(UnitType.TradeShip, source.tile()) ===
            false ||
          selectStrategicCargo(source.owner(), buyer).kind !== "available"
        ) {
          return false;
        }
        return [...destinationComponents].some((component) =>
          this.mg.hasWaterComponent(source.tile(), component),
        );
      })
      .sort((sourceA, sourceB) => {
        const sellerA = sourceA.owner();
        const sellerB = sourceB.owner();
        const alliedDiff =
          Number(buyer.isAlliedWith(sellerB)) -
          Number(buyer.isAlliedWith(sellerA));
        if (alliedDiff !== 0) return alliedDiff;
        const friendlyDiff =
          Number(buyer.isFriendly(sellerB)) - Number(buyer.isFriendly(sellerA));
        if (friendlyDiff !== 0) return friendlyDiff;
        const relationDiff = buyer.relation(sellerB) - buyer.relation(sellerA);
        if (relationDiff !== 0) return relationDiff;
        const distanceDiff =
          this.mg.manhattanDist(this.port.tile(), sourceA.tile()) -
          this.mg.manhattanDist(this.port.tile(), sourceB.tile());
        if (distanceDiff !== 0) return distanceDiff;
        const offerA = selectStrategicCargo(sellerA, buyer);
        const offerB = selectStrategicCargo(sellerB, buyer);
        const availableA = offerA.kind === "available" ? offerA.amount : 0;
        const availableB = offerB.kind === "available" ? offerB.amount : 0;
        if (availableA !== availableB) return availableB - availableA;
        return sourceB.level() - sourceA.level() || sourceA.id() - sourceB.id();
      })
      .slice(0, 1);
  }
}
