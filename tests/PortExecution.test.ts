import { vi } from "vitest";
import { NAVAL_TRADE } from "../src/core/configuration/StrategyConfig";
import { AllianceRequestExecution } from "../src/core/execution/alliance/AllianceRequestExecution";
import { PortExecution } from "../src/core/execution/PortExecution";
import {
  addTradeShipExecution,
  TradeShipExecution,
} from "../src/core/execution/TradeShipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import {
  NaturalResource,
  ProcessedResource,
  STOCK_RESOURCES,
} from "../src/core/game/Resources";
import { setup } from "./util/Setup";

let game: Game;
let player: Player;
let other: Player;

describe("PortExecution", () => {
  beforeEach(async () => {
    game = await setup("half_land_half_ocean", { instantBuild: true }, [
      new PlayerInfo("player", PlayerType.Human, null, "player_id"),
      new PlayerInfo("other", PlayerType.Human, null, "other_id"),
    ]);

    player = game.player("player_id");
    player.addGold(BigInt(1000000));
    other = game.player("other_id");

    game.config().structureMinDist = () => 10;
  });

  test("Destination ports chances scale with level", () => {
    game.config().proximityBonusPortsNb = () => 0;
    game.config().tradeShipShortRangeDebuff = () => 0;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    const otherPort = other.buildUnit(UnitType.Port, game.ref(0, 0), {});
    otherPort.increaseLevel();
    otherPort.increaseLevel();

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(3);
  });

  test("Trade ship proximity bonus", () => {
    game.config().proximityBonusPortsNb = () => 10;
    game.config().tradeShipShortRangeDebuff = () => 0;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    other.buildUnit(UnitType.Port, game.ref(0, 0), {});

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(2);
  });

  test("Trade ship short range debuff", () => {
    game.config().proximityBonusPortsNb = () => 10;
    // Short range debuff cancels out the proximity bonus.
    game.config().tradeShipShortRangeDebuff = () => 100;

    player.conquer(game.ref(7, 10));
    const spawn = player.canBuild(UnitType.Port, game.ref(7, 10));
    if (spawn === false) {
      throw new Error("Unable to build port for test");
    }
    const port = player.buildUnit(UnitType.Port, spawn, {});
    const execution = new PortExecution(port);
    execution.init(game, 0);
    execution.tick(0);

    other.conquer(game.ref(0, 0));
    other.buildUnit(UnitType.Port, game.ref(0, 0), {});

    const ports = execution.tradingPorts();

    expect(ports.length).toBe(1);
  });

  test("naval sector supremacy blocks routes, can be countered, and changes after losses", async () => {
    const navalGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true, strategicEconomy: true },
      [
        new PlayerInfo("player", PlayerType.Human, null, "player_id"),
        new PlayerInfo("other", PlayerType.Human, null, "other_id"),
      ],
    );
    const routeOwner = navalGame.player("player_id");
    const portOwner = navalGame.player("other_id");
    const navalAttacker = navalGame.addPlayer(
      new PlayerInfo("naval attacker", PlayerType.Human, null, "naval_id"),
    );
    routeOwner.addGold(1_000_000n);
    portOwner.addGold(1_000_000n);
    navalAttacker.addGold(1_000_000n);
    routeOwner.addResource(ProcessedResource.Steel, 200);
    portOwner.addResource(ProcessedResource.Steel, 100);
    navalAttacker.addResource(ProcessedResource.Steel, 100);
    const sourceTile = navalGame.ref(7, 10);
    const targetTile = navalGame.ref(0, 0);
    routeOwner.conquer(sourceTile);
    portOwner.conquer(targetTile);
    const sourceSpawn = routeOwner.canBuild(UnitType.Port, sourceTile);
    if (sourceSpawn === false) {
      throw new Error("Unable to build ports for naval-sector test");
    }
    const sourcePort = routeOwner.buildUnit(UnitType.Port, sourceSpawn, {});
    const targetPort = portOwner.buildUnit(UnitType.Port, targetTile, {});
    const waterTiles = [...navalGame.circleSearch(targetPort.tile(), 8)].filter(
      (tile) => navalGame.isWater(tile),
    );
    expect(waterTiles.length).toBeGreaterThan(0);
    const execution = new PortExecution(sourcePort);
    execution.init(navalGame, 0);
    expect(execution.tradingPorts()).toContain(targetPort);
    const navalTile = waterTiles[0];
    const hostileShips = [0, 1].map(() =>
      navalAttacker.buildUnit(UnitType.Warship, navalTile, {
        patrolTile: navalTile,
      }),
    );
    expect(execution.tradingPorts()).not.toContain(targetPort);
    const escort = portOwner.buildUnit(UnitType.Warship, navalTile, {
      patrolTile: navalTile,
    });
    expect(execution.tradingPorts()).toContain(targetPort);
    escort.delete(false);
    navalGame.executeNextTick();
    expect(execution.tradingPorts()).not.toContain(targetPort);
    hostileShips[0].delete(false);
    navalGame.executeNextTick();
    expect(execution.tradingPorts()).toContain(targetPort);
  });

  test("shouldSpawnTradeShip recomputes spawn rate per level with updated rejection count", () => {
    player.conquer(game.ref(7, 10));
    const port = player.buildUnit(UnitType.Port, game.ref(7, 10), {});
    port.increaseLevel(); // level 2
    const execution = new PortExecution(port);
    execution.init(game, 0);

    const rejections: number[] = [];
    game.config().tradeShipSpawnRate = (r) => (rejections.push(r), 1000000);
    expect(execution.shouldSpawnTradeShip()).toBe(false);
    expect(rejections).toEqual([0, 1]);

    game.config().tradeShipSpawnRate = (r) => (rejections.push(r), 1);
    expect(execution.shouldSpawnTradeShip()).toBe(true);
    expect(rejections).toEqual([0, 1, 2]);

    game.config().tradeShipSpawnRate = (r) => (rejections.push(r), 1000000);
    expect(execution.shouldSpawnTradeShip()).toBe(false);
    expect(rejections).toEqual([0, 1, 2, 0, 1]);
  });

  test("stops strategic automatic routes when pending convoys fill the cap", async () => {
    const cappedGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true, strategicEconomy: true },
      [new PlayerInfo("player", PlayerType.Human, null, "player_id")],
    );
    const cappedPlayer = cappedGame.player("player_id");
    cappedPlayer.addGold(1_000_000n);
    cappedPlayer.addResource(ProcessedResource.Steel, 20);
    const tile = cappedGame.ref(7, 10);
    cappedPlayer.conquer(tile);
    const port = cappedPlayer.buildUnit(UnitType.Port, tile, {});
    const execution = new PortExecution(port);
    execution.init(cappedGame, 0);
    vi.spyOn(cappedGame, "unitCount").mockReturnValue(
      NAVAL_TRADE.globalRouteLimit - 1,
    );
    const executions = vi.spyOn(cappedGame, "executions");
    addTradeShipExecution(
      cappedGame,
      new TradeShipExecution(cappedPlayer, port, port),
    );
    const spawnRate = vi.spyOn(cappedGame.config(), "tradeShipSpawnRate");

    expect(execution.shouldSpawnTradeShip()).toBe(false);
    expect(executions).not.toHaveBeenCalled();
    expect(spawnRate).not.toHaveBeenCalled();
  });

  test("imports only from a supplier and prioritizes an ally over a nearer vendor", async () => {
    const tradeGame = await setup(
      "half_land_half_ocean",
      { instantBuild: true, strategicEconomy: true },
      [
        new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
        new PlayerInfo("near supplier", PlayerType.Human, null, "near"),
        new PlayerInfo("allied supplier", PlayerType.Human, null, "ally"),
      ],
    );
    tradeGame.config().structureMinDist = () => 0;
    const buyer = tradeGame.player("buyer");
    const nearSeller = tradeGame.player("near");
    const allySeller = tradeGame.player("ally");
    for (const player of [buyer, nearSeller, allySeller])
      player.addGold(1_000_000n);

    const buyerTile = tradeGame.ref(7, 10);
    const nearTile = tradeGame.ref(7, 9);
    const allyTile = tradeGame.ref(7, 0);
    for (const [player, tile] of [
      [buyer, buyerTile],
      [nearSeller, nearTile],
      [allySeller, allyTile],
    ] as const) {
      player.conquer(tile);
      player.addResource(ProcessedResource.Steel, 100);
    }

    for (const resource of STOCK_RESOURCES) {
      const reserve = NAVAL_TRADE.exportReserve[resource];
      const target = NAVAL_TRADE.importTarget[resource];
      for (const seller of [nearSeller, allySeller]) {
        const stock = seller.resourceAmount(resource);
        if (stock > reserve) seller.removeResource(resource, stock - reserve);
        if (stock < reserve) seller.addResource(resource, reserve - stock);
      }
      const buyerStock = buyer.resourceAmount(resource);
      if (buyerStock > target)
        buyer.removeResource(resource, buyerStock - target);
      if (buyerStock < target) buyer.addResource(resource, target - buyerStock);
    }
    buyer.removeResource(
      NaturalResource.Oil,
      buyer.resourceAmount(NaturalResource.Oil),
    );
    const buyerPort = buyer.buildUnit(UnitType.Port, buyerTile, {});
    const nearPort = nearSeller.buildUnit(UnitType.Port, nearTile, {});
    const allyPort = allySeller.buildUnit(UnitType.Port, allyTile, {});
    const execution = new PortExecution(buyerPort);
    execution.init(tradeGame, tradeGame.ticks());
    expect(execution.supplierPorts()).toEqual([]);

    for (const seller of [nearSeller, allySeller])
      seller.addResource(NaturalResource.Oil, NAVAL_TRADE.cargoUnits);
    tradeGame.addExecution(
      new AllianceRequestExecution(allySeller, buyer.id()),
    );
    tradeGame.executeNextTick();
    tradeGame.addExecution(
      new AllianceRequestExecution(buyer, allySeller.id()),
    );
    tradeGame.executeNextTick();
    expect(buyer.isAlliedWith(allySeller)).toBe(true);

    expect(execution.supplierPorts()).toEqual([allyPort]);
    expect(execution.supplierPorts()).not.toContain(nearPort);
  });

  test("blocks trade while either player has an active attack against the other", async () => {
    const attacker = player;
    const defender = other;
    expect(attacker.canTrade(defender)).toBe(true);
    const attack = attacker.createAttack(defender, 100, null, new Set());
    expect(attacker.canTrade(defender)).toBe(false);
    expect(defender.canTrade(attacker)).toBe(false);
    attack.delete();
    expect(attacker.canTrade(defender)).toBe(true);
  });
});
