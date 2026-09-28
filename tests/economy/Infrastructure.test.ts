import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { InfrastructureRouteExecution } from "../../src/core/execution/InfrastructureRouteExecution";
import { productionEfficiency } from "../../src/core/game/Economy";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

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
