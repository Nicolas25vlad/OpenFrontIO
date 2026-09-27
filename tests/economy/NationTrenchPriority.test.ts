import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import { Game, Player, PlayerInfo, PlayerType } from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic trench priority", () => {
  async function setupFront(strategicEconomy = true): Promise<{
    game: Game;
    nation: Player;
    behavior: NationStructureBehavior;
    frontTile: number;
  }> {
    const game = await setup("big_plains", { strategicEconomy });
    game.addPlayer(new PlayerInfo("nation", PlayerType.Nation, null, "nation"));
    game.addPlayer(new PlayerInfo("enemy", PlayerType.Human, null, "enemy"));
    const nation = game.player("nation");
    const enemy = game.player("enemy");
    let frontTile: number | undefined;

    for (let y = 1; y < game.height() - 1 && frontTile === undefined; y++) {
      for (let x = 1; x < game.width() - 1 && frontTile === undefined; x++) {
        const tile = game.ref(x, y);
        if (!game.isLand(tile)) continue;
        const neighbors: number[] = [];
        const neighborCount = game.neighbors4(tile, neighbors);
        const neighbor = neighbors
          .slice(0, neighborCount)
          .find((candidate) => game.isLand(candidate));
        if (neighbor !== undefined) {
          frontTile = tile;
          nation.conquer(tile);
          enemy.conquer(neighbor);
        }
      }
    }

    if (frontTile === undefined) throw new Error("map has no adjacent land");
    nation.addTroops(1_000);
    enemy.createAttack(nation, 100_000, null, new Set());
    nation.addResource(ProcessedResource.Steel, 100);

    return {
      game,
      nation,
      behavior: new NationStructureBehavior(new PseudoRandom(0), game, nation),
      frontTile,
    };
  }

  it("builds a front-line trench when a land threat and steel are available", async () => {
    const { game, nation, behavior, frontTile } = await setupFront();
    const steelBefore = nation.resourceAmount(ProcessedResource.Steel);

    expect((behavior as any).tryBuildDefenseTrench()).toBe(true);
    game.executeNextTick();

    expect(game.trenchLevel(frontTile)).toBe(1);
    expect(nation.resourceAmount(ProcessedResource.Steel)).toBeLessThan(
      steelBefore,
    );
  });

  it("does not build trenches in legacy games or without enough steel", async () => {
    const legacy = await setupFront(false);
    expect((legacy.behavior as any).tryBuildDefenseTrench()).toBe(false);
    expect(legacy.game.trenchLevel(legacy.frontTile)).toBe(0);

    const strategic = await setupFront();
    strategic.nation.removeResource(
      ProcessedResource.Steel,
      strategic.nation.resourceAmount(ProcessedResource.Steel),
    );
    expect((strategic.behavior as any).tryBuildDefenseTrench()).toBe(false);
    expect(strategic.game.trenchLevel(strategic.frontTile)).toBe(0);
  });
});
