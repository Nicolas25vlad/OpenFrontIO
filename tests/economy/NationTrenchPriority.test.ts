import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
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
    const game = await setup("big_plains", {
      strategicEconomy,
      infiniteGold: true,
      instantBuild: true,
    });
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
    nation.addGold(1_000_000_000n);
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

  it("builds an area trench near an exposed front", async () => {
    const { game, nation, behavior, frontTile } = await setupFront();

    expect((behavior as any).tryBuildTrench()).toBe(true);
    game.executeNextTick();
    game.executeNextTick();

    const [trench] = nation.units(UnitType.Trench);
    expect(trench).toBeDefined();
    expect(
      game.highestLevelUnitNearby(
        frontTile,
        game.config().trenchRange(),
        UnitType.Trench,
        nation.id(),
      ),
    ).toBe(trench);
  });

  it("does not build trenches in legacy games or without steel", async () => {
    const legacy = await setupFront(false);
    expect((legacy.behavior as any).tryBuildTrench()).toBe(false);
    expect(legacy.nation.units(UnitType.Trench)).toHaveLength(0);

    const strategic = await setupFront();
    strategic.nation.removeResource(
      ProcessedResource.Steel,
      strategic.nation.resourceAmount(ProcessedResource.Steel),
    );
    expect((strategic.behavior as any).tryBuildTrench()).toBe(false);
    expect(strategic.nation.units(UnitType.Trench)).toHaveLength(0);
  });
});
