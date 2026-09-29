import { vi } from "vitest";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { productionEfficiency } from "../../src/core/game/Economy";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { GameUpdateType } from "../../src/core/game/GameUpdates";
import { setup } from "../util/Setup";

async function strategicFixture(): Promise<{ game: Game; player: Player }> {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  for (let x = 20; x <= 180; x++) {
    for (let y = 20; y <= 80; y++) player.conquer(game.ref(x, y));
  }
  game.endSpawnPhase();
  return { game, player };
}

async function legacyFixture(): Promise<{ game: Game; player: Player }> {
  const game = await setup(
    "big_plains",
    { strategicEconomy: false, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  for (let x = 20; x <= 180; x++) {
    for (let y = 20; y <= 80; y++) player.conquer(game.ref(x, y));
  }
  game.endSpawnPhase();
  return { game, player };
}

async function finishBuilds(game: Game): Promise<void> {
  for (let i = 0; i < 8; i++) game.executeNextTick();
}

describe("point-placed infrastructure", () => {
  test("builds as one normal structure at the selected tile", async () => {
    const { game, player } = await strategicFixture();
    const tile = game.ref(100, 50);
    game.addExecution(
      new ConstructionExecution(player, UnitType.Infrastructure, tile),
    );

    await finishBuilds(game);

    const infrastructure = player.units(UnitType.Infrastructure);
    expect(infrastructure).toHaveLength(1);
    expect(infrastructure[0].tile()).toBe(tile);
    expect(infrastructure[0].hasTrainStation()).toBe(true);
    expect(
      game.railNetwork().stationManager().findStation(infrastructure[0]),
    ).not.toBeNull();
  });

  test("connects nearby logistics buildings when infrastructure is placed", async () => {
    const { game, player } = await strategicFixture();
    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
    );
    game.addExecution(
      new ConstructionExecution(player, UnitType.Farm, game.ref(80, 50)),
    );
    game.addExecution(
      new ConstructionExecution(
        player,
        UnitType.Infrastructure,
        game.ref(60, 50),
      ),
    );

    await finishBuilds(game);

    const manager = game.railNetwork().stationManager();
    const city = manager.findStation(player.units(UnitType.City)[0]);
    const farm = manager.findStation(player.units(UnitType.Farm)[0]);
    const infrastructure = manager.findStation(
      player.units(UnitType.Infrastructure)[0],
    );
    expect(city).not.toBeNull();
    expect(farm).not.toBeNull();
    expect(infrastructure).not.toBeNull();
    expect(infrastructure?.getCluster()?.has(city!)).toBe(true);
    expect(infrastructure?.getCluster()?.has(farm!)).toBe(true);
    expect(infrastructure?.getCluster()?.size()).toBe(3);
  });

  test("infrastructure dispatches trains on its connected strategic network", async () => {
    const { game, player } = await strategicFixture();
    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(80, 50)),
    );
    game.addExecution(
      new ConstructionExecution(
        player,
        UnitType.Infrastructure,
        game.ref(100, 50),
      ),
    );
    await finishBuilds(game);

    const infrastructure = player.units(UnitType.Infrastructure)[0];
    expect(
      game
        .railNetwork()
        .stationManager()
        .findStation(infrastructure)
        ?.getCluster()
        ?.has(
          game
            .railNetwork()
            .stationManager()
            .findStation(player.units(UnitType.City)[0])!,
        ),
    ).toBe(true);
    vi.spyOn(game.config(), "trainSpawnRate").mockReturnValue(1);

    for (let i = 0; i < 30; i++) game.executeNextTick();

    expect(game.units(UnitType.Train).length).toBeGreaterThan(0);
  });

  test("industry does not create tracks or stations but can use nearby rail bonuses", async () => {
    const { game, player } = await strategicFixture();
    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
    );
    game.addExecution(
      new ConstructionExecution(player, UnitType.Farm, game.ref(80, 50)),
    );
    game.addExecution(
      new ConstructionExecution(
        player,
        UnitType.Infrastructure,
        game.ref(60, 50),
      ),
    );
    await finishBuilds(game);

    const railsBeforeIndustry = game
      .railNetwork()
      .stationManager()
      .getAll().size;
    const addUpdate = vi.spyOn(game, "addUpdate");
    const railroadUpdateCount = () =>
      addUpdate.mock.calls.filter(
        ([update]) => update.type === GameUpdateType.RailroadConstructionEvent,
      ).length;
    const railUpdatesBeforeIndustry = railroadUpdateCount();
    game.addExecution(
      new ConstructionExecution(player, UnitType.Factory, game.ref(100, 50)),
    );
    await finishBuilds(game);

    const factory = player.units(UnitType.Factory)[0];
    expect(factory).toBeDefined();
    expect(factory.hasTrainStation()).toBe(false);
    expect(game.railNetwork().stationManager().findStation(factory)).toBeNull();
    expect(game.railNetwork().stationManager().getAll().size).toBe(
      railsBeforeIndustry,
    );
    expect(railroadUpdateCount()).toBe(railUpdatesBeforeIndustry);
    expect(player.units(UnitType.Infrastructure)).toHaveLength(1);
    expect(productionEfficiency(game, factory).infrastructureBonus).toBe(20);
  });

  test("legacy industry does not create or trigger railroad connections", async () => {
    const { game, player } = await legacyFixture();
    game.addExecution(
      new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
    );
    game.addExecution(
      new ConstructionExecution(player, UnitType.Port, game.ref(80, 50)),
    );
    game.addExecution(
      new ConstructionExecution(player, UnitType.Factory, game.ref(60, 50)),
    );
    const addUpdate = vi.spyOn(game, "addUpdate");

    await finishBuilds(game);

    expect(game.railNetwork().stationManager().getAll().size).toBe(0);
    expect(
      addUpdate.mock.calls.some(
        ([update]) => update.type === GameUpdateType.RailroadConstructionEvent,
      ),
    ).toBe(false);
    expect(
      game
        .railNetwork()
        .computeGhostRailPaths(UnitType.Factory, game.ref(100, 50)),
    ).toEqual([]);
  });
});
