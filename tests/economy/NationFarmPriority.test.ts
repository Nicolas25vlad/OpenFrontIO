import { vi } from "vitest";
import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

test("nation army size no longer creates food-upkeep farm demand", async () => {
  const info = new PlayerInfo("nation", PlayerType.Nation, null, "nation");
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [info],
  );
  const player = game.player(info.id);
  for (let x = 30; x <= 90; x++) {
    for (let y = 30; y <= 90; y++) player.conquer(game.ref(x, y));
  }
  player.setTroops(100_000);
  player.removeResource(
    ProcessedResource.Food,
    player.resourceAmount(ProcessedResource.Food),
  );
  const behavior = new NationStructureBehavior(
    new PseudoRandom(0),
    game,
    player,
  );
  const spawn = vi
    .spyOn(behavior as any, "maybeSpawnStructure")
    .mockReturnValue(false);

  behavior.handleStructures();

  expect(spawn).not.toHaveBeenCalledWith(UnitType.Farm);
});
