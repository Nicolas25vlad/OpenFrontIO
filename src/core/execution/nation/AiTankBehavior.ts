import { STRATEGIC_COMBAT } from "../../configuration/StrategyConfig";
import { Game, Player, UnitType } from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { ConstructionExecution } from "../ConstructionExecution";
import { MoveTankExecution } from "../MoveTankExecution";

const MAX_AI_DEPLOYED_TANKS = 2;

/** Gives map AIs a small independently controlled force while keeping a
 * reserve tank for the existing infantry-attack system. */
export class AiTankBehavior {
  constructor(
    private readonly game: Game,
    private readonly player: Player,
  ) {}

  tick(): void {
    if (
      !this.game.config().strategicEconomy() ||
      this.game.config().isUnitDisabled(UnitType.Tank)
    ) {
      return;
    }

    const tanks = this.player.units(UnitType.Tank);
    const deployedLimit = Math.min(
      MAX_AI_DEPLOYED_TANKS,
      STRATEGIC_COMBAT.maxDeployedTanksPerPlayer,
    );
    if (tanks.length < deployedLimit && this.player.tanks() > 1) {
      const spawnTile = this.spawnTile();
      if (spawnTile !== null) {
        this.game.addExecution(
          new ConstructionExecution(this.player, UnitType.Tank, spawnTile),
        );
        return;
      }
    }

    const idleTanks = tanks.filter(
      (tank) => tank.isActive() && tank.targetTile() === undefined,
    );
    if (idleTanks.length === 0) return;

    const hostileFrontier = this.hostileFrontier();
    if (hostileFrontier.length === 0) return;

    const orderedTargets = new Set<TileRef>();
    for (const tank of idleTanks) {
      const target = hostileFrontier
        .filter((tile) => !orderedTargets.has(tile))
        .sort(
          (a, b) =>
            this.game.manhattanDist(tank.tile(), a) -
              this.game.manhattanDist(tank.tile(), b) || a - b,
        )[0];
      if (target === undefined) break;
      orderedTargets.add(target);
      this.game.addExecution(
        new MoveTankExecution(this.player, [tank.id()], target),
      );
    }
  }

  private spawnTile(): TileRef | null {
    return (
      Array.from(this.player.borderTiles())
        .sort((a, b) => a - b)
        .find((tile) => this.player.canBuild(UnitType.Tank, tile) !== false) ??
      null
    );
  }

  private hostileFrontier(): TileRef[] {
    const targets = new Set<TileRef>();
    for (const borderTile of this.player.borderTiles()) {
      this.game.forEachNeighbor(borderTile, (tile) => {
        const owner = this.game.owner(tile);
        if (
          !targets.has(tile) &&
          owner.isPlayer() &&
          owner !== this.player &&
          !this.player.isFriendly(owner) &&
          this.player.canAttackPlayer(owner)
        ) {
          targets.add(tile);
        }
      });
    }
    return Array.from(targets).sort((a, b) => a - b);
  }
}
