import { ConstructionExecution } from "../src/core/execution/ConstructionExecution";
import { AiTankBehavior } from "../src/core/execution/nation/AiTankBehavior";
import { TribeExecution } from "../src/core/execution/TribeExecution";
import { Game, PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

async function botGame(strategicEconomy = true): Promise<Game> {
  return setup(
    "big_plains",
    { strategicEconomy, infiniteGold: true, instantBuild: true },
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

  test.each([
    { label: "with only the protected legacy reserve", strategicEconomy: true },
    { label: "when strategic economy is disabled", strategicEconomy: false },
  ])("does not deploy tanks $label", async ({ strategicEconomy }) => {
    const game = await botGame(strategicEconomy);
    const bot = game.player("bot");
    bot.conquer(game.ref(50, 50));
    bot.addTanks(strategicEconomy ? 1 : 3);

    new AiTankBehavior(game, bot).tick();
    game.executeNextTick();

    expect(bot.units(UnitType.Tank)).toHaveLength(0);
    expect(bot.tanks()).toBe(strategicEconomy ? 1 : 3);
  });

  test("tribe execution deploys reserve tanks in strategic economy", async () => {
    const game = await botGame();
    const tribe = game.player("bot");
    tribe.conquer(game.ref(50, 50));
    game.player("rival").conquer(game.ref(51, 50));
    tribe.addTanks(2);

    const addExecution = vi.spyOn(game, "addExecution");
    const execution = new TribeExecution(tribe);
    execution.init(game);

    for (let tick = 0; tick < 200; tick++) {
      execution.tick(tick);
      if (
        addExecution.mock.calls.some(
          ([queued]) => queued instanceof ConstructionExecution,
        )
      ) {
        break;
      }
    }

    expect(addExecution).toHaveBeenCalledWith(
      expect.any(ConstructionExecution),
    );
  });
});
