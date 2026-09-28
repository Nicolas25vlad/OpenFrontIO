import { ECONOMY } from "../../src/core/configuration/StrategyConfig";
import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic vehicle factory priority", () => {
  let game: Game;
  let player: Player;
  let behavior: NationStructureBehavior;

  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true },
      [new PlayerInfo("nation", PlayerType.Nation, null, "nation")],
    );
    player = game.player("nation");
    behavior = new NationStructureBehavior(new PseudoRandom(0), game, player);
  });

  it.each([10_000, 50_000, 100_000])(
    "builds one factory for an army with %i troops when tank inputs are available",
    (troops) => {
      player.addTroops(troops - player.troops());
      const build = vi
        .spyOn(behavior as any, "maybeSpawnStructure")
        .mockReturnValue(true);

      expect((behavior as any).tryBuildVehicleFactory()).toBe(true);
      expect(build).toHaveBeenCalledExactlyOnceWith(UnitType.VehicleFactory);
      expect((behavior as any).tryBuildVehicleFactory()).toBe(false);
      expect(build).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { economy: "low", steel: 34, fuel: 2, shouldBuild: false },
    { economy: "medium", steel: 35, fuel: 2, shouldBuild: true },
    { economy: "high", steel: 50, fuel: 20, shouldBuild: true },
  ])(
    "uses safe tank-production decisions with $economy material reserves",
    ({ steel, fuel, shouldBuild }) => {
      player.addTroops(50_000 - player.troops());
      for (const resource of [
        ProcessedResource.Steel,
        ProcessedResource.Fuel,
      ]) {
        player.removeResource(resource, player.resourceAmount(resource));
      }
      player.addResource(ProcessedResource.Steel, steel);
      player.addResource(ProcessedResource.Fuel, fuel);
      const build = vi
        .spyOn(behavior as any, "maybeSpawnStructure")
        .mockReturnValue(true);

      expect((behavior as any).tryBuildVehicleFactory()).toBe(shouldBuild);
      expect(build).toHaveBeenCalledTimes(Number(shouldBuild));
    },
  );

  it.each([
    { economy: "low", steel: 34, circuits: 5, fuel: 2, shouldBuild: false },
    {
      economy: "low-circuits",
      steel: 35,
      circuits: 4,
      fuel: 2,
      shouldBuild: false,
    },
    { economy: "medium", steel: 35, circuits: 5, fuel: 2, shouldBuild: true },
    { economy: "high", steel: 50, circuits: 10, fuel: 20, shouldBuild: true },
  ])(
    "builds a factory and produces its first tank with $economy reserves",
    async ({ steel, circuits, fuel, shouldBuild }) => {
      for (let x = 25; x <= 75; x++) {
        for (let y = 25; y <= 75; y++) player.conquer(game.ref(x, y));
      }
      player.addTroops(50_000 - player.troops());
      player.addGold(1_000_000_000n);
      player.removeResource(
        ProcessedResource.Steel,
        player.resourceAmount(ProcessedResource.Steel),
      );
      player.removeResource(
        ProcessedResource.Fuel,
        player.resourceAmount(ProcessedResource.Fuel),
      );
      player.removeResource(
        ProcessedResource.Circuits,
        player.resourceAmount(ProcessedResource.Circuits),
      );
      player.addResource(ProcessedResource.Steel, steel);
      player.addResource(ProcessedResource.Circuits, circuits);
      player.addResource(ProcessedResource.Fuel, fuel);

      const order = (behavior as any).tryBuildVehicleFactory();
      expect(order).toBe(shouldBuild);

      for (
        let tick = 0;
        tick <
        game.unitInfo(UnitType.VehicleFactory).constructionDuration! +
          ECONOMY.periodTicks +
          3;
        tick++
      ) {
        game.executeNextTick();
      }

      expect(player.units(UnitType.VehicleFactory)).toHaveLength(
        Number(shouldBuild),
      );
      expect(player.tanks()).toBe(Number(shouldBuild));
    },
  );

  it("does not build without recipe inputs or when the tank reserve is full", () => {
    const build = vi
      .spyOn(behavior as any, "maybeSpawnStructure")
      .mockReturnValue(true);
    player.addTroops(50_000 - player.troops());
    player.removeResource(
      ProcessedResource.Fuel,
      player.resourceAmount(ProcessedResource.Fuel),
    );

    expect((behavior as any).tryBuildVehicleFactory()).toBe(false);
    player.addResource(ProcessedResource.Fuel, 2);
    player.addTanks(5);
    expect(player.troops()).toBe(50_000);
    expect(player.tanks()).toBe(5);
    expect((behavior as any).tryBuildVehicleFactory()).toBe(false);
    expect(build).not.toHaveBeenCalled();
  });

  it("does not add vehicle factories to legacy games", async () => {
    const legacyGame = await setup(
      "big_plains",
      { strategicEconomy: false, infiniteGold: true },
      [new PlayerInfo("legacy", PlayerType.Nation, null, "legacy")],
    );
    const legacyPlayer = legacyGame.player("legacy");
    legacyPlayer.addTroops(50_000 - legacyPlayer.troops());
    const legacyBehavior = new NationStructureBehavior(
      new PseudoRandom(0),
      legacyGame,
      legacyPlayer,
    );
    const build = vi
      .spyOn(legacyBehavior as any, "maybeSpawnStructure")
      .mockReturnValue(true);

    expect((legacyBehavior as any).tryBuildVehicleFactory()).toBe(false);
    expect(build).not.toHaveBeenCalled();
  });
});
