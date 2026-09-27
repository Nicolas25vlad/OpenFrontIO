import { Config } from "../../src/core/configuration/Config";
import { SAMLauncherExecution } from "../../src/core/execution/SAMLauncherExecution";
import {
  Game,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { STOCK_RESOURCES } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

describe.each([false, true])(
  "Anti-ICBM interception with strategic economy %s",
  (strategicEconomy) => {
    let game: Game;

    beforeEach(async () => {
      game = await setup(
        "big_plains",
        { strategicEconomy, infiniteGold: true, instantBuild: true },
        [
          new PlayerInfo("defender", PlayerType.Human, null, "defender"),
          new PlayerInfo("attacker", PlayerType.Human, null, "attacker"),
        ],
        undefined,
        Config,
      );
    });

    it("uses the configured range in the core interception decision", () => {
      const defender = game.player("defender");
      const attacker = game.player("attacker");
      for (const resource of STOCK_RESOURCES) {
        defender.addResource(resource, 1000);
        attacker.addResource(resource, 1000);
      }

      const samTile = game.ref(1, 1);
      const nukeTile = game.ref(80, 1);
      const sam = defender.buildUnit(UnitType.SAMLauncher, samTile, {});
      game.addExecution(new SAMLauncherExecution(defender, null, sam));
      const nuke = attacker.buildUnit(UnitType.AtomBomb, nukeTile, {
        targetTile: nukeTile,
        trajectory: Array.from({ length: 40 }, () => ({
          tile: nukeTile,
          targetable: true,
        })),
      });

      for (let tick = 0; tick < 30; tick++) game.executeNextTick();

      expect(nuke.isActive()).toBe(!strategicEconomy);
    });
  },
);
