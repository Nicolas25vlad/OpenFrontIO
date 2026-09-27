import { ECONOMY } from "../../src/core/configuration/StrategyConfig";
import { AttackExecution } from "../../src/core/execution/AttackExecution";
import { AiAttackBehavior } from "../../src/core/execution/utils/AiAttackBehavior";
import { Game, Player, PlayerInfo, PlayerType } from "../../src/core/game/Game";
import {
  NaturalResource,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe.each([true, false])(
  "nation resource expansion with strategic economy %s",
  (strategicEconomy) => {
    let game: Game;
    let bot: Player;
    let behavior: AiAttackBehavior;

    beforeEach(async () => {
      game = await setup("big_plains", {
        strategicEconomy,
        infiniteGold: true,
        infiniteTroops: true,
      });
      game.addPlayer(
        new PlayerInfo("miner", PlayerType.Bot, null, "miner_bot"),
      );
      bot = game.player("miner_bot");
      const node = game
        .resourceNodes()
        .find((candidate) => candidate.resource === NaturalResource.Iron);
      if (node === undefined) throw new Error("Iron deposit missing from map");

      const depositTile = game.ref(node.x, node.y);
      const adjacentLand = game
        .neighbors(depositTile)
        .find((tile) => game.isLand(tile) && !game.isImpassable(tile));
      if (adjacentLand === undefined)
        throw new Error("Iron deposit has no adjacent land tile");
      bot.conquer(adjacentLand);
      bot.addTroops(500_000);

      for (const resource of STOCK_RESOURCES) {
        bot.removeResource(resource, bot.resourceAmount(resource));
      }
      for (const [resource, target] of Object.entries(
        ECONOMY.mineStockTargets,
      )) {
        bot.addResource(resource as NaturalResource, target);
      }
      if (strategicEconomy) {
        bot.removeResource(
          NaturalResource.Iron,
          bot.resourceAmount(NaturalResource.Iron),
        );
      }

      behavior = new AiAttackBehavior(new PseudoRandom(0), game, bot, 0, 0, 0);
    });

    it("steers neutral expansion toward scarce deposits only when enabled", () => {
      const addExecution = vi.spyOn(game, "addExecution");

      expect(behavior.sendAttack(game.terraNullius(), true)).toBe(true);

      const execution = addExecution.mock.calls[0][0] as AttackExecution;
      const preferredTile = (execution as any).preferredExpansionTile as
        | number
        | null;
      if (strategicEconomy) {
        expect(preferredTile).not.toBeNull();
        expect(
          game
            .resourceDepositsAt(preferredTile!)
            .some((node) => node.resource === NaturalResource.Iron),
        ).toBe(true);
      } else {
        expect(preferredTile).toBeNull();
      }
    });
  },
);
