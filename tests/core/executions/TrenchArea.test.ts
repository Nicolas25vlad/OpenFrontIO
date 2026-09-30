import { Config } from "../../../src/core/configuration/Config";
import { STRATEGIC_COMBAT } from "../../../src/core/configuration/StrategyConfig";
import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "../../../src/core/game/Game";
import { ProcessedResource } from "../../../src/core/game/Resources";
import { setup } from "../../util/Setup";

describe("area trench construction", () => {
  it("builds as a normal structure and covers tiles within its smaller radius", async () => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [new PlayerInfo("player", PlayerType.Human, null, "player")],
    );
    const player = game.player("player");
    const center = game.ref(50, 50);
    player.conquer(center);
    const steelCost =
      game.config().resourceCost(UnitType.Trench)[ProcessedResource.Steel] ?? 0;
    player.removeResource(
      ProcessedResource.Steel,
      player.resourceAmount(ProcessedResource.Steel),
    );
    player.addResource(ProcessedResource.Steel, steelCost);

    expect(player.canBuild(UnitType.Trench, center)).toBe(center);
    game.addExecution(
      new ConstructionExecution(player, UnitType.Trench, center),
    );
    game.executeNextTick();
    game.executeNextTick();

    const [trench] = player.units(UnitType.Trench);
    expect(trench).toBeDefined();
    expect(trench.isUnderConstruction()).toBe(false);
    expect(player.resourceAmount(ProcessedResource.Steel)).toBe(0);
    expect(
      game.highestLevelUnitNearby(
        game.ref(65, 50),
        game.config().trenchRange(),
        UnitType.Trench,
        player.id(),
      ),
    ).toBe(trench);
    expect(
      game.highestLevelUnitNearby(
        game.ref(66, 50),
        game.config().trenchRange(),
        UnitType.Trench,
        player.id(),
      ),
    ).toBeUndefined();
    expect(game.config().trenchRange()).toBeLessThan(
      game.config().defensePostRange(),
    );
  });

  it("keeps trench combat effects and tank breakthrough after removing upkeep", async () => {
    const game = await setup("plains", { strategicEconomy: true });
    const input = {
      terrain: TerrainType.Plains,
      attackTroops: 55_000,
      attacker: { type: PlayerType.Human, numTiles: 1_000, tanks: 1 },
      defender: {
        type: PlayerType.Human,
        numTiles: 1_000,
        troops: 50_000,
        isTraitor: false,
        isDisconnectedTeammate: false,
      },
      defenderHasDefensePost: false,
      defenderDefensePostLevel: 0,
      falloutRatio: null,
      borderSize: 50,
    } as const;
    const noTrench = Config.prototype.attackLogic.call(game.config(), input);
    const defended = Config.prototype.attackLogic.call(game.config(), {
      ...input,
      defenderTrenchLevel: 1,
    });
    const richlyDefended = Config.prototype.attackLogic.call(game.config(), {
      ...input,
      defenderTrenchLevel: STRATEGIC_COMBAT.trenchMaxLevel,
    });

    expect(defended.attackerTroopLoss).toBeGreaterThan(
      noTrench.attackerTroopLoss,
    );
    expect(richlyDefended.tickFraction).toBeGreaterThan(defended.tickFraction);
  });
});
