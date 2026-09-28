import { vi } from "vitest";
import { RailroadCache } from "../../src/client/render/frame/RailroadCache";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { InfrastructureRouteExecution } from "../../src/core/execution/InfrastructureRouteExecution";
import { productionEfficiency } from "../../src/core/game/Economy";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import {
  GameUpdateType,
  GameUpdateViewData,
  RailroadConstructionUpdate,
} from "../../src/core/game/GameUpdates";
import { ProcessedResource } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

async function routeFixture() {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  player.addGold(5_000_000n);
  for (let x = 30; x <= 100; x++)
    for (let y = 30; y <= 70; y++) player.conquer(game.ref(x, y));
  game.endSpawnPhase();
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.Factory, game.ref(90, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.Farm, game.ref(65, 55)),
  );
  for (let i = 0; i < 8; i++) game.executeNextTick();
  return {
    game,
    player,
    city: player.units(UnitType.City)[0],
    factory: player.units(UnitType.Factory)[0],
    farm: player.units(UnitType.Farm)[0],
  };
}

test("a selected route connects logistics buildings and powers the economy", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  player.addGold(1_000_000n);
  for (let x = 30; x <= 170; x++)
    for (let y = 30; y <= 70; y++) player.conquer(game.ref(x, y));
  game.endSpawnPhase();

  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.Factory, game.ref(140, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.Farm, game.ref(80, 52)),
  );
  for (let i = 0; i < 5; i++) game.executeNextTick();

  const city = player.units(UnitType.City)[0];
  const factory = player.units(UnitType.Factory)[0];
  const farm = player.units(UnitType.Farm)[0];
  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), factory.id()]),
  );
  game.executeNextTick();
  game.executeNextTick();

  const manager = game.railNetwork().stationManager();
  const cluster = manager.findStation(city)?.getCluster();
  expect(cluster?.has(manager.findStation(factory)!)).toBe(true);
  expect(cluster?.has(manager.findStation(farm)!)).toBe(true);
  expect(productionEfficiency(game, factory).infrastructureBonus).toBe(20);
  player.updateEconomy(10);
  expect(player.supplyStatus().logistics).toBeGreaterThan(0);
  expect(game.unitCount(UnitType.Train)).toBe(0);

  factory.delete(false);
  farm.delete(false);
  player.updateEconomy(20);
  expect(player.supplyStatus().logistics).toBe(0);
});

test("route requests reject incompatible buildings without charging resources", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  for (let x = 30; x <= 80; x++)
    for (let y = 30; y <= 70; y++) player.conquer(game.ref(x, y));
  game.endSpawnPhase();
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.DefensePost, game.ref(60, 50)),
  );
  for (let i = 0; i < 5; i++) game.executeNextTick();
  const city = player.units(UnitType.City)[0];
  const defense = player.units(UnitType.DefensePost)[0];
  const steelBefore = player.resourceAmount(ProcessedResource.Steel);

  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), defense.id()]),
  );
  game.executeNextTick();
  game.executeNextTick();

  expect(game.railNetwork().stationManager().findStation(city)).not.toBeNull();
  expect(game.railNetwork().stationManager().findStation(defense)).toBeNull();
  expect(
    game.railNetwork().stationManager().findStation(city)?.neighbors(),
  ).toHaveLength(0);
  expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore);
});

test("rejects an underfunded route without charging or creating rail", async () => {
  const { game, player, city, factory } = await routeFixture();
  player.removeGold(player.gold());
  const goldBefore = player.gold();
  const steelBefore = player.resourceAmount(ProcessedResource.Steel);

  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), factory.id()]),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  expect(player.gold()).toBe(goldBefore);
  expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore);
  expect(
    game.railNetwork().stationManager().findStation(city)?.neighbors(),
  ).toHaveLength(0);
  expect(
    game.railNetwork().stationManager().findStation(factory)?.neighbors(),
  ).toHaveLength(0);
});

test("rejects a route without enough steel and preserves its gold", async () => {
  const { game, player, city, factory } = await routeFixture();
  player.removeGold(player.gold());
  player.removeResource(
    ProcessedResource.Steel,
    player.resourceAmount(ProcessedResource.Steel),
  );
  player.addGold(100_000n);
  const goldBefore = player.gold();
  const steelBefore = player.resourceAmount(ProcessedResource.Steel);

  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), factory.id()]),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  expect(player.gold()).toBe(goldBefore);
  expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore);
  expect(
    game.railNetwork().stationManager().findStation(city)?.neighbors(),
  ).toHaveLength(0);
  expect(
    game.railNetwork().stationManager().findStation(factory)?.neighbors(),
  ).toHaveLength(0);
});

test("connects three selected logistics nodes in the requested order", async () => {
  const { game, player, city, farm, factory } = await routeFixture();
  player.addResource(ProcessedResource.Steel, 10);
  const routeUnits = [city, farm, factory];
  const plannedPaths = game.railNetwork().planInfrastructureRoute(routeUnits)!;
  const plannedTiles = plannedPaths.reduce(
    (total, path) => total + path.length,
    0,
  );
  const expectedGold = game
    .config()
    .infrastructureRouteGoldCost(plannedTiles, player);
  const expectedSteel = Math.ceil(
    plannedTiles / game.config().infrastructureRoute().steelPerTiles,
  );
  const goldBefore = player.gold();
  const steelBefore = player.resourceAmount(ProcessedResource.Steel);
  const railroadUpdates: RailroadConstructionUpdate[] = [];

  game.addExecution(
    new InfrastructureRouteExecution(player, [
      city.id(),
      farm.id(),
      factory.id(),
    ]),
  );
  for (let i = 0; i < 2; i++) {
    const updates = game.executeNextTick();
    railroadUpdates.push(...updates[GameUpdateType.RailroadConstructionEvent]);
  }

  const manager = game.railNetwork().stationManager();
  const cityStation = manager.findStation(city)!;
  const farmStation = manager.findStation(farm)!;
  const factoryStation = manager.findStation(factory)!;
  expect(cityStation.getRailroadTo(farmStation)).not.toBeNull();
  expect(farmStation.getRailroadTo(factoryStation)).not.toBeNull();
  expect(cityStation.getCluster()?.has(factoryStation)).toBe(true);
  expect(goldBefore - player.gold()).toBe(expectedGold);
  expect(steelBefore - player.resourceAmount(ProcessedResource.Steel)).toBe(
    expectedSteel,
  );

  const updateData = {
    updates: {
      [GameUpdateType.RailroadConstructionEvent]: railroadUpdates,
    },
  } as unknown as GameUpdateViewData;
  const liveCache = new RailroadCache(game.width(), game.height());
  const replayCache = new RailroadCache(game.width(), game.height());
  liveCache.apply(updateData);
  replayCache.apply(updateData);
  expect(railroadUpdates).toHaveLength(2);
  expect([...liveCache.getRailroads()]).toEqual([
    ...replayCache.getRailroads(),
  ]);
  for (const update of railroadUpdates) {
    expect(liveCache.getRailroads().get(update.id)).toEqual(update.tiles);
  }
});

test("rejects duplicate route nodes without charging or connecting buildings", async () => {
  const { game, player, city } = await routeFixture();
  const goldBefore = player.gold();
  const steelBefore = player.resourceAmount(ProcessedResource.Steel);

  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), city.id()]),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  expect(player.gold()).toBe(goldBefore);
  expect(player.resourceAmount(ProcessedResource.Steel)).toBe(steelBefore);
  expect(
    game.railNetwork().stationManager().findStation(city)?.neighbors(),
  ).toHaveLength(0);
});

test("limits path planning to the configured maximum of selected nodes", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  game.endSpawnPhase();
  const routeConfig = game.config().infrastructureRoute();
  const requestedNodeCount = routeConfig.maxNodes + 1;
  const planRoute = vi.spyOn(game.railNetwork(), "planInfrastructureRoute");

  game.addExecution(
    new InfrastructureRouteExecution(
      player,
      Array.from({ length: requestedNodeCount }, (_, index) => index + 1000),
    ),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  expect(planRoute).not.toHaveBeenCalled();
});

test("capturing a route node severs the old owner rail and creates a new node", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [
      new PlayerInfo("p", PlayerType.Human, null, "p"),
      new PlayerInfo("q", PlayerType.Human, null, "q"),
    ],
  );
  const player = game.player("p");
  const other = game.player("q");
  player.addGold(1_000_000n);
  for (let x = 30; x <= 100; x++)
    for (let y = 30; y <= 70; y++) player.conquer(game.ref(x, y));
  game.endSpawnPhase();
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.Factory, game.ref(90, 50)),
  );
  for (let i = 0; i < 8; i++) game.executeNextTick();
  const city = player.units(UnitType.City)[0];
  const factory = player.units(UnitType.Factory)[0];
  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), factory.id()]),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  const manager = game.railNetwork().stationManager();
  const previousStation = manager.findStation(factory);
  expect(previousStation).not.toBeNull();
  expect(manager.findStation(city)?.getCluster()?.size()).toBe(2);
  factory.setOwner(other);

  const capturedStation = manager.findStation(factory);
  expect(capturedStation).not.toBeNull();
  expect(capturedStation).not.toBe(previousStation);
  expect(manager.findStation(city)?.getCluster()?.size()).toBe(1);
  expect(capturedStation?.getCluster()?.size()).toBe(1);
});

test("a supply center contributes logistics only through the capital rail network", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  for (let x = 30; x <= 100; x++)
    for (let y = 30; y <= 70; y++) player.conquer(game.ref(x, y));
  game.endSpawnPhase();
  game.addExecution(
    new ConstructionExecution(player, UnitType.City, game.ref(40, 50)),
  );
  game.addExecution(
    new ConstructionExecution(player, UnitType.SupplyCenter, game.ref(90, 50)),
  );
  for (let i = 0; i < 8; i++) game.executeNextTick();
  const city = player.units(UnitType.City)[0];
  const supplyCenter = player.units(UnitType.SupplyCenter)[0];

  player.updateEconomy(10);
  expect(player.supplyStatus().logistics).toBe(0);
  game.addExecution(
    new InfrastructureRouteExecution(player, [city.id(), supplyCenter.id()]),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();
  player.updateEconomy(20);
  expect(player.supplyStatus().logistics).toBe(15);
});

test("strategic infrastructure is a route action, not a placed structure", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const player = game.player("p");
  player.conquer(game.ref(50, 50));
  game.endSpawnPhase();

  game.addExecution(
    new ConstructionExecution(
      player,
      UnitType.Infrastructure,
      game.ref(50, 50),
    ),
  );
  for (let i = 0; i < 2; i++) game.executeNextTick();

  expect(player.units(UnitType.Infrastructure)).toHaveLength(0);
});
