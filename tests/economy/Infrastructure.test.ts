import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { productionEfficiency } from "../../src/core/game/Economy";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import { setup } from "../util/Setup";

test("infrastructure connects existing cities, improves logistics, and never creates trains", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("p", PlayerType.Human, null, "p")],
  );
  const p = game.player("p");
  for (let x = 30; x <= 170; x++)
    for (let y = 30; y <= 70; y++) p.conquer(game.ref(x, y));
  for (const [type, x] of [
    [UnitType.City, 40],
    [UnitType.Infrastructure, 140],
  ] as const) {
    game.addExecution(new ConstructionExecution(p, type, game.ref(x, 50)));
  }
  for (let i = 0; i < 30; i++) game.executeNextTick();
  const infra = p.units(UnitType.Infrastructure)[0];
  const manager = game.railNetwork().stationManager();
  expect(manager.findStation(infra)?.getCluster()?.size()).toBe(2);
  expect(
    productionEfficiency(game, infra).infrastructureBonus,
  ).toBeGreaterThanOrEqual(20);
  p.updateEconomy(30);
  expect(p.supplyStatus().logistics).toBeGreaterThan(0);
  expect(game.unitCount(UnitType.Train)).toBe(0);
  infra.delete(false);
  expect(manager.findStation(infra)).toBeNull();
  p.updateEconomy(40);
  expect(p.supplyStatus().logistics).toBe(0);
});
