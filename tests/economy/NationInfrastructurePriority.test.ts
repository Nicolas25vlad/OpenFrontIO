import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { InfrastructureRouteExecution } from "../../src/core/execution/InfrastructureRouteExecution";
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

  it("builds a supply center and links it to the capital rail network", () => {
    const farm = player.units(UnitType.Farm)[0];
    expect(farm).toBeDefined();
    expect(productionEfficiency(game, farm).infrastructureBonus).toBe(0);

    expect((behavior as any).tryBuildInfrastructure()).toBe(true);
    expect((behavior as any).tryBuildInfrastructure()).toBe(false);

    for (let i = 0; i < 45; i++) game.executeNextTick();

    expect(player.units(UnitType.SupplyCenter)).toHaveLength(1);
    const city = player.units(UnitType.City)[0];
    const supplyCenter = player.units(UnitType.SupplyCenter)[0];
    game.addExecution(
      new InfrastructureRouteExecution(player, [city.id(), supplyCenter.id()]),
    );
    for (let i = 0; i < 2; i++) game.executeNextTick();
    expect(
      game
        .railNetwork()
        .stationManager()
        .findStation(supplyCenter)
        ?.getCluster()
        ?.size(),
    ).toBe(2);
    player.updateEconomy(50);
    expect(player.supplyStatus().logistics).toBeGreaterThan(0);
  });

  it.each(["infantry", "navy", "tanks"] as const)(
    "builds logistics infrastructure for a %s supply shortage only",
    (service) => {
      game.addExecution(
        new ConstructionExecution(
          player,
          UnitType.SupplyCenter,
          game.ref(120, 50),
        ),
      );
      for (let i = 0; i < 45; i++) game.executeNextTick();
      const city = player.units(UnitType.City)[0];
      const supplyCenter = player.units(UnitType.SupplyCenter)[0];
      game.addExecution(
        new InfrastructureRouteExecution(player, [
          city.id(),
          supplyCenter.id(),
        ]),
      );
      for (let i = 0; i < 2; i++) game.executeNextTick();

      const supply = player.supplyStatus();
      expect(supply.infantry).toBe(100);
      vi.spyOn(player, "supplyStatus").mockReturnValue({
        ...supply,
        [service]: 99,
      });
      const build = vi
        .spyOn(behavior as any, "maybeSpawnStructure")
        .mockReturnValue(true);

      const value = (behavior as any).infrastructureValue();
      expect(value(game.ref(102, 50))).toBeGreaterThan(
        value(game.ref(199, 199)),
      );
      expect((behavior as any).tryBuildInfrastructure()).toBe(true);
      expect(build).toHaveBeenCalledExactlyOnceWith(UnitType.SupplyCenter);

      vi.spyOn(player, "supplyStatus").mockReturnValue(supply);
      const healthyBehavior = new NationStructureBehavior(
        new PseudoRandom(0),
        game,
        player,
      );
      const healthyBuild = vi
        .spyOn(healthyBehavior as any, "maybeSpawnStructure")
        .mockReturnValue(true);

      expect((healthyBehavior as any).tryBuildInfrastructure()).toBe(false);
      expect(healthyBuild).not.toHaveBeenCalled();
    },
  );
});
