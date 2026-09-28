import { AiTankBehavior } from "../src/core/execution/nation/AiTankBehavior";
import { Game, PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

async function botGame(): Promise<Game> {
  return setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [
      new PlayerInfo("bot", PlayerType.Bot, null, "bot"),
      new PlayerInfo("rival", PlayerType.Human, "rival-client", "rival"),
    ],
  );
}

describe("AI tank behavior", () => {
  test("deploys one reserve tank and orders it without spending another reserve", async () => {
    const game = await botGame();
    const bot = game.player("bot");
    const rival = game.player("rival");
    const spawnTile = game.ref(50, 50);
    const targetTile = game.ref(51, 50);
    bot.conquer(spawnTile);
    rival.conquer(targetTile);
    bot.addTanks(2);

    const behavior = new AiTankBehavior(game, bot);
    behavior.tick();
    game.executeNextTick();
    game.executeNextTick();

    expect(bot.tanks()).toBe(1);
    expect(bot.units(UnitType.Tank)).toHaveLength(1);

    behavior.tick();
    game.executeNextTick();

    expect(bot.tanks()).toBe(1);
    const orderTarget = bot.units(UnitType.Tank)[0].targetTile();
    expect(orderTarget).toBeDefined();
    expect(bot.canAttack(orderTarget!)).toBe(true);
    expect(game.owner(orderTarget!)).not.toBe(bot);
  });
});
