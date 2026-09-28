import { STRATEGIC_COMBAT } from "../configuration/StrategyConfig";
import { consumeResources, hasResources } from "../game/Economy";
import { Execution, Game, Player } from "../game/Game";
import { TileRef } from "../game/GameMap";

/** Paints one deterministic trench level on an owned border tile. */
export class BuildTrenchExecution implements Execution {
  private active = true;
  private readonly tiles: TileRef[];

  constructor(
    private readonly player: Player,
    tiles: TileRef | readonly TileRef[],
  ) {
    this.tiles = [...new Set(Array.isArray(tiles) ? tiles : [tiles])].sort(
      (a, b) => a - b,
    );
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(game: Game): void {
    if (!this.active) return;
    if (!game.config().strategicEconomy() || game.inSpawnPhase()) {
      this.active = false;
      return;
    }
    const cost = game.config().trenchCost();
    for (const tile of this.tiles) {
      if (
        !game.isValidRef(tile) ||
        !game.isLand(tile) ||
        game.isImpassable(tile) ||
        game.ownerID(tile) !== this.player.smallID() ||
        !game.isBorder(tile) ||
        game.trenchLevel(tile) >= STRATEGIC_COMBAT.trenchMaxLevel ||
        !hasResources(this.player, cost) ||
        !consumeResources(this.player, cost)
      ) {
        continue;
      }
      game.setTrenchLevel(tile, game.trenchLevel(tile) + 1);
    }
    this.active = false;
  }

  tick(): void {}

  isActive(): boolean {
    return this.active;
  }
}
