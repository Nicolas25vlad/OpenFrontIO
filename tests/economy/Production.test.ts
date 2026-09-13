import { ECONOMY } from "../../src/core/configuration/StrategyConfig";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { ProductionExecution } from "../../src/core/execution/ProductionExecution";
import {
  consumeResources,
  productionEfficiency,
} from "../../src/core/game/Economy";
import {
  Game,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { GameUpdateType } from "../../src/core/game/GameUpdates";
import {
  ProcessedResource as Product,
  NaturalResource as Raw,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

async function economyGame(enabled = true): Promise<Game> {
  return setup(
    "big_plains",
    { strategicEconomy: enabled, infiniteGold: true, instantBuild: true },
    [
      new PlayerInfo(
        "industry",
        PlayerType.Human,
        "industry-client",
        "industry",
      ),
    ],
  );
}

function build(game: Game, type: UnitType, x = 50, y = 50) {
  const player = game.player("industry");
  const tile = game.ref(x, y);
  player.conquer(tile);
  for (const [resource, amount] of Object.entries(
    game.config().resourceCost(type),
  )) {
    player.addResource(
      resource as import("../../src/core/game/Resources").ResourceType,
      amount,
    );
  }
  return player.buildUnit(type, tile, {});
}

function emptyStocks(game: Game) {
  const player = game.player("industry");
  for (const resource of STOCK_RESOURCES)
    player.removeResource(resource, player.resourceAmount(resource));
  player.finishResourcePeriod();
}

describe("strategic production", () => {
  test("industrial throughput is shared, repeats no tick, and never enriches uranium", async () => {
    const game = await economyGame();
    emptyStocks(game);
    const player = game.player("industry");
    const factory = build(game, UnitType.Factory);
    const production = new ProductionExecution(factory);
    production.init(game);
    for (const raw of Object.values(Raw)) player.addResource(raw, 100);
    player.finishResourcePeriod();
    production.tick(10);
    const stock = { ...player.resourceStock() };
    expect(player.resourceAmount(Product.Fuel)).toBe(4);
    expect(player.resourceAmount(Product.RefinedIron)).toBe(3);
    expect(player.resourceAmount(Product.Steel)).toBe(0);
    production.tick(10);
    expect(player.resourceStock()).toEqual(stock);
    production.tick(20);
    expect(player.resourceAmount(Product.Steel)).toBe(3);
    for (let ticks = 30; ticks <= 200; ticks += 10) production.tick(ticks);
    for (const product of [
      Product.Fuel,
      Product.Steel,
      Product.GoldBars,
      Product.Circuits,
      Product.Fertilizer,
    ]) {
      expect(player.resourceAmount(product)).toBeGreaterThan(0);
    }
    expect(player.resourceAmount(Product.EnrichedUranium)).toBe(0);
    expect(player.resourceAmount(Raw.Uranium)).toBe(100);
  });

  test("missing ingredients cause no partial consumption and recover after restock", async () => {
    const game = await economyGame();
    emptyStocks(game);
    const player = game.player("industry");
    player.addResource(Raw.Uranium, 12);
    const production = new ProductionExecution(
      build(game, UnitType.NuclearPlant),
    );
    production.init(game);
    production.tick(10);
    expect(player.resourceAmount(Raw.Uranium)).toBe(12);
    expect(player.resourceAmount(Product.EnrichedUranium)).toBe(0);
    player.addResource(Product.Fuel, 1);
    production.tick(20);
    expect(player.resourceAmount(Raw.Uranium)).toBe(9);
    expect(player.resourceAmount(Product.Fuel)).toBe(0);
    expect(player.resourceAmount(Product.EnrichedUranium)).toBe(1);
    expect(
      consumeResources(player, { [Raw.Uranium]: 1, [Product.Fuel]: 1 }),
    ).toBe(false);
    expect(player.resourceAmount(Raw.Uranium)).toBe(9);
  });

  test("farms bootstrap food and fertilizer increases production", async () => {
    const game = await economyGame();
    emptyStocks(game);
    const player = game.player("industry");
    const farm = build(game, UnitType.Farm);
    const production = new ProductionExecution(farm);
    production.init(game);
    production.tick(10);
    expect(player.resourceAmount(Product.Food)).toBe(ECONOMY.farmFood);
    player.addResource(Product.Fertilizer, 1);
    production.tick(20);
    expect(player.resourceAmount(Product.Food)).toBe(
      ECONOMY.farmFood + ECONOMY.fertilizedFood,
    );
    expect(player.resourceAmount(Product.Fertilizer)).toBe(0);
    farm.setUnderConstruction(true);
    production.tick(30);
    expect(player.resourceAmount(Product.Food)).toBe(24);
  });

  test("local city and infrastructure bonuses are bounded and ownership-aware", async () => {
    const game = await economyGame();
    const factory = build(game, UnitType.Factory);
    const city = build(game, UnitType.City, 80, 50);
    const infra = build(game, UnitType.Infrastructure, 50, 80);
    expect(productionEfficiency(game, factory).efficiency).toBe(120);
    for (let i = 0; i < 10; i++) {
      city.increaseLevel();
      infra.increaseLevel();
    }
    expect(productionEfficiency(game, factory).efficiency).toBe(170);
    city.setUnderConstruction(true);
    expect(productionEfficiency(game, factory).efficiency).toBe(140);
  });

  test("the same construction turns replay to identical stocks, rates, units and hashes", async () => {
    const run = async () => {
      const game = await economyGame();
      emptyStocks(game);
      const player = game.player("industry");
      player.conquer(game.ref(50, 50));
      player.addResource(Raw.Oil, 200);
      game.addExecution(
        new ConstructionExecution(player, UnitType.Factory, game.ref(50, 50)),
      );
      const hashes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const updates = game.executeNextTick();
        hashes.push(...updates[GameUpdateType.Hash].map((u) => u.hash));
      }
      return {
        stock: player.resourceStock(),
        rates: player.resourceRates(),
        units: player.units().map((u) => u.toUpdate()),
        hashes,
      };
    };
    expect(await run()).toEqual(await run());
  });

  test("legacy configs produce no processed resources and disable new buildings", async () => {
    const game = await economyGame(false);
    const factory = build(game, UnitType.Factory);
    const player = game.player("industry");
    const production = new ProductionExecution(factory);
    production.init(game);
    player.addResource(Raw.Oil, 100);
    production.tick(10);
    expect(player.resourceAmount(Product.Fuel)).toBe(0);
    expect(game.config().isUnitDisabled(UnitType.Farm)).toBe(true);
  });
});
