import { consumeResources, hasResources } from "../game/Economy";
import { Execution, Game, Player } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { STRATEGIC_COMBAT } from "../configuration/StrategyConfig";

/** Paints one deterministic trench level on an owned border tile. */
export class BuildTrenchExecution implements Execution {
  private active = true;

  constructor(
    private readonly player: Player,
    private readonly tile: TileRef,
  ) {}

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(game: Game): void {
    if (!this.active) return;
    if (!game.config().strategicEconomy() || game.inSpawnPhase()) {
      this.active = false;
      return;
    }
    if (
      !game.isValidRef(this.tile) ||
      !game.isLand(this.tile) ||
      game.isImpassable(this.tile) ||
      game.ownerID(this.tile) !== this.player.smallID() ||
      !game.isBorder(this.tile)
    ) {
      this.active = false;
      return;
    }

    const level = game.trenchLevel(this.tile);
    if (level >= STRATEGIC_COMBAT.trenchMaxLevel) {
      this.active = false;
      return;
    }
    const cost = game.config().trenchCost();
    if (!hasResources(this.player, cost) || !consumeResources(this.player, cost)) {
      this.active = false;
      return;
    }
    game.setTrenchLevel(this.tile, level + 1);
    this.active = false;
  }

  tick(): void {}

  isActive(): boolean {
    return this.active;
  }
}
