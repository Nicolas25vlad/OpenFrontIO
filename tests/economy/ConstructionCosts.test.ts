import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { UpgradeStructureExecution } from "../../src/core/execution/UpgradeStructureExecution";
import {
  PlayerInfo,
  PlayerType,
  UnitType,
  maxBulkAmount,
} from "../../src/core/game/Game";
import { ProcessedResource as Product } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

test("previews match atomic build and bulk upgrade costs, even in the same turn", async () => {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("builder", PlayerType.Human, null, "builder")],
  );
  const player = game.player("builder");
  const tiles = [game.ref(50, 50), game.ref(150, 150)];
  tiles.forEach((tile) => player.conquer(tile));
  const cost = game.config().resourceCost(UnitType.Infrastructure);
  const steel = cost[Product.Steel]!;
  expect(steel).toBeGreaterThan(0);
  player.removeResource(Product.Steel, player.resourceAmount(Product.Steel));
  player.addResource(Product.Steel, steel);
  const preview = player.buildableUnits(tiles[0], [UnitType.Infrastructure])[0];
  expect(preview.resourceCost).toEqual(cost);
  expect(preview.canBuild).toBe(tiles[0]);
  expect(maxBulkAmount(preview, player.gold())).toBe(1);
  for (const tile of tiles)
    game.addExecution(
      new ConstructionExecution(player, UnitType.Infrastructure, tile),
    );
  for (let i = 0; i < 3; i++) game.executeNextTick();
  expect(player.units(UnitType.Infrastructure)).toHaveLength(1);
  expect(player.resourceAmount(Product.Steel)).toBe(0);
  const unit = player.units(UnitType.Infrastructure)[0];
  player.addResource(Product.Steel, steel * 2);
  const upgrade = new UpgradeStructureExecution(player, unit.id(), 10);
  upgrade.init(game, game.ticks());
  expect(unit.level()).toBe(3);
  expect(player.resourceAmount(Product.Steel)).toBe(0);
  expect(player.canUpgradeUnit(unit)).toBe(false);
});

test("unaffordable direct construction cannot create a unit or spend partial inputs", async () => {
  const game = await setup(
    "plains",
    { strategicEconomy: true, infiniteGold: true },
    [new PlayerInfo("builder", PlayerType.Human, null, "builder")],
  );
  const player = game.player("builder");
  const tile = game.ref(50, 50);
  player.conquer(tile);
  player.removeResource(
    Product.Circuits,
    player.resourceAmount(Product.Circuits),
  );
  const before = { ...player.resourceStock() };
  expect(() => player.buildUnit(UnitType.NuclearPlant, tile, {})).toThrow();
  expect(player.units(UnitType.NuclearPlant)).toHaveLength(0);
  expect(player.resourceStock()).toEqual(before);
  for (const type of [UnitType.Mine, UnitType.Factory, UnitType.Farm]) {
    expect(game.config().resourceCost(type)).toEqual({});
  }
  expect(player.canBuild(UnitType.Farm, -1)).toBe(false);
});
