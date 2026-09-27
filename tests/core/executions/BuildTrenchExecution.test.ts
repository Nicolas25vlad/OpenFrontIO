import { BuildTrenchExecution } from "../../../src/core/execution/BuildTrenchExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
} from "../../../src/core/game/Game";
import { GameUpdateType } from "../../../src/core/game/GameUpdates";
import { ProcessedResource } from "../../../src/core/game/Resources";
import { setup } from "../../util/Setup";

describe("BuildTrenchExecution", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { strategicEconomy: true },
      [new PlayerInfo("player", PlayerType.Human, "client", "player")],
    );
    player = game.player("player");
  });

  test("builds up to three levels on owned border tiles and charges per level", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const steelBefore = player.resourceAmount(ProcessedResource.Steel);

    for (let level = 1; level <= 3; level++) {
      new BuildTrenchExecution(player, tile).init(game);
      expect(game.trenchLevel(tile)).toBe(level);
    }
    new BuildTrenchExecution(player, tile).init(game);

    expect(game.trenchLevel(tile)).toBe(3);
    expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore - 9);
  });

  test("rejects tiles not owned by the requesting player without spending steel", async () => {
    const tile = game.ref(50, 50);
    const steelBefore = player.resourceAmount(ProcessedResource.Steel);

    new BuildTrenchExecution(player, tile).init(game);

    expect(game.trenchLevel(tile)).toBe(0);
    expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore);
  });

  test("captures and relinquishes clear the packed trench state", () => {
    const tile = game.ref(50, 50);
    const other = game.addPlayer(
      new PlayerInfo("other", PlayerType.Human, "other-client", "other"),
    );
    player.conquer(tile);
    game.setTrenchLevel(tile, 2);

    other.conquer(tile);
    expect(game.trenchLevel(tile)).toBe(0);
    game.setTrenchLevel(tile, 1);
    other.relinquish(tile);
    expect(game.trenchLevel(tile)).toBe(0);
  });

  test("includes trench state in the deterministic game hash", async () => {
    const control = await setup(
      "big_plains",
      { strategicEconomy: true },
      [new PlayerInfo("player", PlayerType.Human, "client", "player")],
    );
    const tile = game.ref(50, 50);
    player.conquer(tile);
    control.player("player").conquer(tile);
    game.setTrenchLevel(tile, 2);

    const gameHash = game.executeNextTick()[GameUpdateType.Hash][0].hash;
    const controlHash =
      control.executeNextTick()[GameUpdateType.Hash][0].hash;
    expect(gameHash).not.toBe(controlHash);
  });
});
