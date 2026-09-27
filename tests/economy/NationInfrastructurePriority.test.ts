import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import { productionEfficiency } from "../../src/core/game/Economy";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic infrastructure priority", () => {
  let game: Game;
  let player: Player;
  let behavior: NationStructureBehavior;

  beforeEach(async () => {
    const info = new PlayerInfo(
      "builder",
      PlayerType.Human,
      null,
      "builder_id",
    );
    game = await setup(
      "big_plains",
      {
        strategicEconomy: true,
        infiniteGold: true,
        instantBuild: true,
      },
      [info],
    );
    player = game.player(info.id);
    for (let x = 30; x <= 170; x++) {
      for (let y = 30; y <= 70; y++) {
        player.conquer(game.ref(x, y));
      }
    }

    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(100, 50)),
    );
    game.addExecution(
      new ConstructionExecution(player, UnitType.Farm, game.ref(110, 50)),
    );
    for (let i = 0; i < 35; i++) game.executeNextTick();

    behavior = new NationStructureBehavior(new PseudoRandom(0), game, player);
  });

  it("places infrastructure to cover a farm and applies the production bonus", () => {
    const farm = player.units(UnitType.Farm)[0];
    expect(farm).toBeDefined();
    expect(productionEfficiency(game, farm).infrastructureBonus).toBe(0);

    expect((behavior as any).tryBuildInfrastructure()).toBe(true);
    expect((behavior as any).tryBuildInfrastructure()).toBe(false);

    for (let i = 0; i < 45; i++) game.executeNextTick();

    expect(player.units(UnitType.Infrastructure)).toHaveLength(1);
    expect(
      productionEfficiency(game, farm).infrastructureBonus,
    ).toBeGreaterThanOrEqual(10);
    player.updateEconomy(game.ticks());
    expect(player.supplyStatus().logistics).toBeGreaterThan(0);
  });
});
