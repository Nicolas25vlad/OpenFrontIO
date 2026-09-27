import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic farm priority", () => {
  it("chooses a valid farm site when food reserves fall below army demand", async () => {
    const info = new PlayerInfo("nation", PlayerType.Nation, null, "nation");
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [info],
    );
    const player = game.player(info.id);
    for (let x = 30; x <= 90; x++) {
      for (let y = 30; y <= 90; y++) {
        player.conquer(game.ref(x, y));
      }
    }
    player.addGold(1_000_000_000n);
    player.addTroops(50_000 - player.troops());
    player.removeResource(
      ProcessedResource.Food,
      player.resourceAmount(ProcessedResource.Food),
    );
    const behavior = new NationStructureBehavior(
      new PseudoRandom(0),
      game,
      player,
    );
    const valueFactory = vi.spyOn(behavior as any, "structureSpawnTileValue");
    const addExecution = vi.spyOn(game, "addExecution");

    expect(player.troops()).toBe(50_000);
    expect(game.config().strategicEconomy()).toBe(true);
    expect(player.resourceAmount(ProcessedResource.Food)).toBe(0);
    expect((behavior as any).tryBuildFoodFarm()).toBe(true);
    expect(valueFactory).toHaveBeenCalledExactlyOnceWith(UnitType.Farm);
    expect(addExecution).toHaveBeenCalledTimes(1);
    const execution = addExecution.mock.calls[0][0] as ConstructionExecution;
    expect(execution).toBeInstanceOf(ConstructionExecution);
    expect((execution as any).constructionType).toBe(UnitType.Farm);
  });
});
