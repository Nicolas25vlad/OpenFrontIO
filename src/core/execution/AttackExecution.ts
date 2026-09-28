import { renderTroops } from "../../client/Utils";
import { AttackLogicInput } from "../configuration/Config";
import { STRATEGIC_COMBAT } from "../configuration/StrategyConfig";
import {
  Attack,
  Difficulty,
  Execution,
  Game,
  MessageType,
  Player,
  PlayerID,
  PlayerType,
  TerrainType,
  TerraNullius,
  Unit,
  UnitType,
} from "../game/Game";
import { GameMap, TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { assertNever } from "../Util";
import { FlatBinaryHeap } from "./utils/FlatBinaryHeap"; // adjust path if needed

const malusForRetreat = 25;
const RESOURCE_EXPANSION_DISTANCE_WEIGHT = 0.1;
export class AttackExecution implements Execution {
  private active: boolean = true;
  private toConquer = new FlatBinaryHeap();

  private random = new PseudoRandom(123);
  private tankCasualtyRemainder = 0;

  private target: Player | TerraNullius;

  private mg: Game;
  // Direct GameMap reference to skip the Game delegation hop in hot loops.
  private map: GameMap;

  private attack: Attack | null = null;
  private startTanks = 0;

  // Cached smallIDs for integer owner comparisons in hot loops.
  private ownerSmallID: number;
  private targetSmallID: number;
  // Reusable neighbor buffers to avoid closures/allocation in hot loops.
  private nbuf: TileRef[] = [0, 0, 0, 0];
  private nbuf2: TileRef[] = [0, 0, 0, 0];

  constructor(
    private startTroops: number | null = null,
    private _owner: Player,
    private _targetID: PlayerID | null,
    private sourceTile: TileRef | null = null,
    private removeTroops: boolean = true,
    private preferredExpansionTile: TileRef | null = null,
    private requestedTanks?: number,
  ) {}

  public targetID(): PlayerID | null {
    return this._targetID;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(mg: Game, ticks: number) {
    if (!this.active) {
      return;
    }
    this.mg = mg;
    this.map = mg.map();

    if (this._targetID !== null && !mg.hasPlayer(this._targetID)) {
      console.warn(`target ${this._targetID} not found`);
      this.active = false;
      return;
    }

    this.target =
      this._targetID === this.mg.terraNullius().id()
        ? mg.terraNullius()
        : mg.player(this._targetID);
    this.ownerSmallID = this._owner.smallID();
    this.targetSmallID = this.target.smallID();

    if (this._owner === this.target) {
      console.error(`Player ${this._owner} cannot attack itself`);
      this.active = false;
      return;
    }

    // ALLIANCE CHECK — block attacks on friendly (ally or same team)
    if (this.target.isPlayer()) {
      const targetPlayer = this.target as Player;
      if (this._owner.isFriendly(targetPlayer)) {
        console.warn(
          `${this._owner.displayName()} cannot attack ${targetPlayer.displayName()} because they are friendly (allied or same team)`,
        );
        this.active = false;
        return;
      }
    }

    if (this.target && this.target.isPlayer()) {
      const targetPlayer = this.target as Player;
      if (
        targetPlayer.type() !== PlayerType.Bot &&
        this._owner.type() !== PlayerType.Bot
      ) {
        // Don't let bots embargo since they can't trade anyway.
        targetPlayer.addEmbargo(this._owner, true);
        this.rejectIncomingAllianceRequests(targetPlayer);
      }
    }

    if (this.target.isPlayer() && !this._owner.canAttackPlayer(this.target)) {
      this.active = false;
      return;
    }

    this.startTroops ??= this.mg
      .config()
      .attackAmount(this._owner, this.target);
    if (this.removeTroops) {
      this.startTroops = Math.min(this._owner.troops(), this.startTroops);
      // Take the amount that was actually deducted, not the amount asked for.
      // removeTroops() floors, so a fractional request leaves the attack
      // holding troops the owner never paid for — and retreat refunds the
      // combined total, turning the leftover fractions into free troops.
      this.startTroops = this._owner.removeTroops(this.startTroops);
    }
    // Land orders reserve tanks here. Naval tanks were reserved when the ship
    // departed and arrive as cargo, so their count is bounded but not debited
    // a second time.
    if (this.mg.config().strategicEconomy() && this.sourceTile !== null) {
      this.startTanks = Math.min(
        Math.floor(this.startTroops / STRATEGIC_COMBAT.infantryPerTank),
        Math.max(0, Math.floor(this.requestedTanks ?? 0)),
      );
    } else if (
      this.removeTroops &&
      this.sourceTile === null &&
      this.mg.config().strategicEconomy()
    ) {
      const troopBasedTankLimit = Math.floor(
        this.startTroops / STRATEGIC_COMBAT.infantryPerTank,
      );
      const requestedTanks = Math.min(
        troopBasedTankLimit,
        this.requestedTanks ?? troopBasedTankLimit,
      );
      this.startTanks = this._owner.removeTanks(requestedTanks);
    }
    this.attack = this._owner.createAttack(
      this.target,
      this.startTroops,
      this.sourceTile,
      new Set<TileRef>(),
      this.startTanks,
    );

    if (this.sourceTile !== null) {
      this.addNeighbors(this.sourceTile);
    } else {
      this.refreshToConquer();
    }

    // Record stats
    this.mg.stats().attack(this._owner, this.target, this.startTroops);

    for (const incoming of this._owner.incomingAttacks()) {
      if (incoming.attacker() === this.target) {
        // Target has opposing attack, cancel them out
        if (incoming.troops() > this.attack.troops()) {
          const originalTroops = incoming.troops();
          const remaining = originalTroops - this.attack.troops();
          incoming.setTroops(remaining);
          incoming.setTanks(
            this.tanksForRemainingForce(incoming, remaining, originalTroops),
          );
          this.attack.delete();
          this.active = false;
          return;
        } else {
          const originalTroops = this.attack.troops();
          const remaining = originalTroops - incoming.troops();
          this.attack.setTroops(remaining);
          this.attack.setTanks(
            this.tanksForRemainingForce(this.attack, remaining, originalTroops),
          );
          incoming.setTanks(0);
          incoming.delete();
        }
      }
    }
    for (const outgoing of this._owner.outgoingAttacks()) {
      if (
        outgoing !== this.attack &&
        outgoing.target() === this.attack.target() &&
        // Boat attacks (sourceTile is not null) are not combined with other attacks
        this.attack.sourceTile() === null
      ) {
        this.attack.setTroops(this.attack.troops() + outgoing.troops());
        this.attack.setTanks(this.attack.tanks() + outgoing.tanks());
        outgoing.delete();
      }
    }

    if (this.target.isPlayer()) {
      const difficulty = this.mg.config().gameConfig().difficulty;
      let relationChange: number;
      switch (difficulty) {
        case Difficulty.Easy:
          relationChange = -60;
          break;
        case Difficulty.Medium:
          relationChange = -70;
          break;
        case Difficulty.Hard:
          relationChange = -80;
          break;
        case Difficulty.Impossible:
          relationChange = -100;
          break;
        default:
          assertNever(difficulty);
      }
      this.target.updateRelation(this._owner, relationChange);
    }
  }

  private refreshToConquer() {
    if (this.attack === null) {
      throw new Error("Attack not initialized");
    }

    this.toConquer.clear();
    this.attack.clearBorder();
    // forEach over the dense storage — the values() generator showed up in long-game profiles
    this._owner.borderTiles().forEach((tile) => this.addNeighbors(tile));
  }

  private retreat(malusPercent = 0) {
    if (this.attack === null) {
      throw new Error("Attack not initialized");
    }

    const deaths = this.attack.troops() * (malusPercent / 100);
    if (deaths) {
      this.mg.displayMessage(
        "events_display.attack_cancelled_retreat",
        MessageType.ATTACK_CANCELLED,
        this._owner.id(),
        undefined,
        { troops: renderTroops(deaths) },
      );
    }
    if (this.removeTroops === false && this.sourceTile === null) {
      // startTroops are always added to attack troops at init but not always removed from owner troops
      // subtract startTroops from attack troops so we don't give back startTroops to owner that were never removed
      // boat attacks (sourceTile !== null) are the exception: troops were removed at departure and must be returned after attack still
      this.attack.setTroops(this.attack.troops() - (this.startTroops ?? 0));
    }

    const survivors = this.attack.troops() - deaths;
    this._owner.addTroops(survivors);
    const tankDeaths = Math.ceil(this.attack.tanks() * (malusPercent / 100));
    this._owner.addTanks(this.attack.tanks() - tankDeaths);
    this.attack.delete();
    this.active = false;

    // Not all retreats are canceled attacks
    if (this.attack.retreated()) {
      // Record stats
      this.mg.stats().attackCancel(this._owner, this.target, survivors);
    }
  }

  tick(ticks: number) {
    if (this.attack === null) {
      throw new Error("Attack not initialized");
    }
    let troopCount = this.attack.troops(); // cache troop count
    const targetIsPlayer = this.target.isPlayer(); // cache target type
    const targetPlayer = targetIsPlayer ? (this.target as Player) : null; // cache target player

    if (this.attack.retreated()) {
      if (targetIsPlayer) {
        this.retreat(malusForRetreat);
      } else {
        this.retreat();
      }
      this.active = false;
      return;
    }

    if (this.attack.retreating()) {
      return;
    }

    if (!this.attack.isActive()) {
      this.active = false;
      return;
    }

    if (targetPlayer && this._owner.isFriendly(targetPlayer)) {
      // In this case a new alliance was created AFTER the attack started.
      this.retreat();
      return;
    }

    const borderSize = this.attack.borderSize() + this.random.nextInt(0, 5);
    // Each tile consumes a fraction of the tick; conquer until it is spent.
    let tickBudget = 1;

    while (tickBudget > 0) {
      if (troopCount < 1) {
        this.attack.delete();
        this.active = false;
        return;
      }

      if (this.toConquer.size() === 0) {
        this.refreshToConquer();
        this.retreat();
        return;
      }

      const tileToConquer = this.toConquer.dequeue();
      this.attack.removeBorderTile(tileToConquer);

      let onBorder = false;
      const numNeighbors = this.map.neighbors4(tileToConquer, this.nbuf);
      for (let i = 0; i < numNeighbors; i++) {
        if (this.map.ownerID(this.nbuf[i]) === this.ownerSmallID) {
          onBorder = true;
          break;
        }
      }
      if (this.map.ownerID(tileToConquer) !== this.targetSmallID || !onBorder) {
        continue;
      }
      if (
        !this.map.isLand(tileToConquer) ||
        this.map.isImpassable(tileToConquer)
      ) {
        continue;
      }
      this.addNeighbors(tileToConquer);
      const defenderPost = targetPlayer
        ? this.mg.highestLevelUnitNearby(
            tileToConquer,
            this.mg.config().defensePostRange(),
            UnitType.DefensePost,
            targetPlayer.id(),
          )
        : undefined;
      const { attackerTroopLoss, defenderTroopLoss, tickFraction } = this.mg
        .config()
        .attackLogic(
          this.attackLogicInput(
            troopCount,
            tileToConquer,
            borderSize,
            defenderPost,
          ),
        );
      tickBudget -= tickFraction;
      troopCount -= attackerTroopLoss;
      this.attack.setTroops(troopCount);
      this.applyTankCasualties(attackerTroopLoss, troopCount);
      if (targetPlayer) {
        targetPlayer.removeTroops(defenderTroopLoss);
      }
      if (defenderPost && this.mg.config().strategicEconomy()) {
        defenderPost.modifyHealth(
          -STRATEGIC_COMBAT.defensePostWearPerTile,
          this._owner,
        );
      }
      const trenchLevel = this.mg.trenchLevel(tileToConquer);
      if (trenchLevel > 0 && this.mg.config().strategicEconomy()) {
        this.mg.setTrenchLevel(
          tileToConquer,
          Math.max(0, trenchLevel - STRATEGIC_COMBAT.trenchWearPerResolvedTile),
        );
      }
      this._owner.conquer(tileToConquer);
      this.handleDeadDefender();
    }
  }

  private attackLogicInput(
    attackTroops: number,
    tile: TileRef,
    borderSize: number,
    defenderPost: Unit | undefined,
  ): AttackLogicInput {
    const defender = this.target.isPlayer() ? this.target : null;
    const attackStrength =
      attackTroops +
      (this.attack?.tanks() ?? 0) * STRATEGIC_COMBAT.tankCombatPower;
    // Same test as scanning nearbyUnits() for a post owned by the defender
    // (active, not under construction, within range), without building a
    // result array per conquered tile — this runs for every tile of every
    // attack on the map.
    return {
      terrain: this.map.terrainType(tile),
      attackTroops: attackStrength,
      attacker: {
        type: this._owner.type(),
        numTiles: this._owner.numTilesOwned(),
        supply: this._owner.supplyStatus().infantry,
        logistics: this._owner.supplyStatus().logistics,
        tanks: this.attack?.tanks() ?? 0,
        trenchLevel: this.attackerStagingTrenchLevel(tile),
      },
      defender:
        defender === null
          ? null
          : {
              type: defender.type(),
              numTiles: defender.numTilesOwned(),
              troops: defender.troops(),
              supply: defender.supplyStatus().infantry,
              isTraitor: defender.isTraitor(),
              isDisconnectedTeammate:
                defender.isDisconnected() && this._owner.isOnSameTeam(defender),
            },
      defenderHasDefensePost: defenderPost !== undefined,
      defenderDefensePostLevel: defenderPost?.level() ?? 0,
      defenderTrenchLevel: this.mg.trenchLevel(tile),
      falloutRatio: this.mg.hasFallout(tile)
        ? this.mg.numTilesWithFallout() / this.mg.numLandTiles()
        : null,
      borderSize,
    };
  }

  /**
   * Land attacks leaving a fortified border pay the offensive penalty. If a
   * target tile touches both fortified and open attacker tiles, the attacker
   * can choose the open approach; naval attacks have no land staging trench.
   */
  private attackerStagingTrenchLevel(tile: TileRef): number {
    if (this.sourceTile !== null) return 0;
    let minimumLevel: number = STRATEGIC_COMBAT.trenchMaxLevel;
    let foundAttackerBorder = false;
    const neighborCount = this.map.neighbors4(tile, this.nbuf);
    for (let i = 0; i < neighborCount; i++) {
      const neighbor = this.nbuf[i];
      if (this.map.ownerID(neighbor) !== this.ownerSmallID) continue;
      foundAttackerBorder = true;
      minimumLevel = Math.min(minimumLevel, this.mg.trenchLevel(neighbor));
      if (minimumLevel === 0) return 0;
    }
    return foundAttackerBorder ? minimumLevel : 0;
  }

  private tanksForRemainingForce(
    attack: Attack,
    remainingTroops: number,
    originalTroops: number,
  ): number {
    if (originalTroops <= 0) return 0;
    return Math.floor(attack.tanks() * (remainingTroops / originalTroops));
  }

  private applyTankCasualties(
    attackerTroopLoss: number,
    remainingTroops: number,
  ): void {
    if (
      this.attack === null ||
      this.attack.tanks() === 0 ||
      attackerTroopLoss <= 0
    ) {
      return;
    }
    const force =
      Math.max(0, remainingTroops) +
      this.attack.tanks() * STRATEGIC_COMBAT.tankCombatPower;
    if (force <= 0) return;
    const expectedLosses =
      (attackerTroopLoss *
        this.attack.tanks() *
        STRATEGIC_COMBAT.tankCasualtyMultiplier) /
      force;
    this.tankCasualtyRemainder += expectedLosses;
    const casualties = Math.min(
      this.attack.tanks(),
      Math.floor(this.tankCasualtyRemainder),
    );
    if (casualties > 0) {
      this.attack.setTanks(this.attack.tanks() - casualties);
      this.tankCasualtyRemainder -= casualties;
    }
  }

  private rejectIncomingAllianceRequests(target: Player) {
    const request = this._owner
      .incomingAllianceRequests()
      .find((ar) => ar.requestor() === target);
    if (request !== undefined) {
      request.reject();
    }
  }

  private addNeighbors(tile: TileRef) {
    if (this.attack === null) {
      throw new Error("Attack not initialized");
    }

    const tickNow = this.mg.ticks(); // cache tick

    const numNeighbors = this.map.neighbors4(tile, this.nbuf);
    for (let i = 0; i < numNeighbors; i++) {
      const neighbor = this.nbuf[i];
      if (
        this.map.isWater(neighbor) ||
        this.map.isImpassable(neighbor) ||
        this.map.ownerID(neighbor) !== this.targetSmallID
      ) {
        continue;
      }
      this.attack.addBorderTile(neighbor);
      let numOwnedByMe = 0;
      const numInner = this.map.neighbors4(neighbor, this.nbuf2);
      for (let j = 0; j < numInner; j++) {
        if (this.map.ownerID(this.nbuf2[j]) === this.ownerSmallID) {
          numOwnedByMe++;
        }
      }

      let mag: number;
      switch (this.map.terrainType(neighbor)) {
        case TerrainType.Plains:
          mag = 1;
          break;
        case TerrainType.Highland:
          mag = 1.5;
          break;
        case TerrainType.Mountain:
          mag = 2;
          break;
        default:
          mag = 0;
          break;
      }

      let priority =
        (this.random.nextInt(0, 7) + 10) * (1 - numOwnedByMe * 0.5 + mag / 2) +
        tickNow;
      if (this.preferredExpansionTile !== null) {
        priority +=
          this.mg.manhattanDist(neighbor, this.preferredExpansionTile) *
          RESOURCE_EXPANSION_DISTANCE_WEIGHT;
      }

      this.toConquer.enqueue(neighbor, priority);
    }
  }

  private handleDeadDefender() {
    if (!(this.target.isPlayer() && this.target.numTilesOwned() < 100)) return;
    const target: Player = this.target;

    this.mg.conquerPlayer(this._owner, target);

    const MAX_PASSES = 100;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let progressed = false;
      for (const tile of target.tiles()) {
        let borders = false;
        this.mg.forEachNeighbor(tile, (t) => {
          if (!borders && this.mg.owner(t) === this._owner) {
            borders = true;
          }
        });
        if (borders) {
          this._owner.conquer(tile);
          progressed = true;
        } else {
          let captured = false;
          this.mg.forEachNeighbor(tile, (neighbor) => {
            if (captured) return;
            const no = this.mg.owner(neighbor);
            if (no.isPlayer() && no !== target && !no.isFriendly(target)) {
              this.mg.player(no.id()).conquer(tile);
              captured = true;
            }
          });
          if (captured) progressed = true;
        }
      }
      if (!progressed) break;
    }
  }

  owner(): Player {
    return this._owner;
  }

  isActive(): boolean {
    return this.active;
  }
}
