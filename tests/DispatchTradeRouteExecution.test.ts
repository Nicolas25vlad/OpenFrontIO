import { DispatchTradeRouteExecution } from "../src/core/execution/DispatchTradeRouteExecution";
import { TradeShipExecution } from "../src/core/execution/TradeShipExecution";
import { PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { ProcessedResource } from "../src/core/game/Resources";
import { setup } from "./util/Setup";

describe("DispatchTradeRouteExecution", () => {
  async function routeFixture(strategicEconomy = true) {
    const game = await setup(
      "half_land_half_ocean",
      { instantBuild: true, strategicEconomy },
      [
        new PlayerInfo("source", PlayerType.Human, null, "source_id"),
        new PlayerInfo("destination", PlayerType.Human, null, "destination_id"),
      ],
    );
    const sourceOwner = game.player("source_id");
    const destinationOwner = game.player("destination_id");
    sourceOwner.addGold(1_000_000n);
    destinationOwner.addGold(1_000_000n);
    const sourceTile = game.ref(7, 10);
    const destinationTile = game.ref(7, 0);
    sourceOwner.conquer(sourceTile);
    destinationOwner.conquer(destinationTile);
    const sourceSpawn = sourceOwner.canBuild(UnitType.Port, sourceTile);
    if (sourceSpawn === false) throw new Error("source port tile unavailable");
    const sourcePort = sourceOwner.buildUnit(UnitType.Port, sourceSpawn, {});
    const destinationPort = destinationOwner.buildUnit(
      UnitType.Port,
      destinationTile,
      {},
    );
    game.endSpawnPhase();
    return { game, sourceOwner, destinationOwner, sourcePort, destinationPort };
  }

  test("dispatches one convoy to the explicitly selected destination", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture();
    game.addExecution(
      new DispatchTradeRouteExecution(
        sourceOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 4; tick++) game.executeNextTick();

    const ships = sourceOwner.units(UnitType.TradeShip);
    expect(ships).toHaveLength(1);
    expect(ships[0].targetUnit()).toBe(destinationPort);
  });

  test("rejects routes when the player does not own the source port", async () => {
    const { game, destinationOwner, sourcePort, destinationPort } =
      await routeFixture();
    game.addExecution(
      new DispatchTradeRouteExecution(
        destinationOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 3; tick++) game.executeNextTick();

    expect(game.units(UnitType.TradeShip)).toHaveLength(0);
  });

  test("rejects routes when either port owner has embargoed the other", async () => {
    const { game, sourceOwner, destinationOwner, sourcePort, destinationPort } =
      await routeFixture();
    destinationOwner.addEmbargo(sourceOwner, false);
    game.addExecution(
      new DispatchTradeRouteExecution(
        sourceOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 4; tick++) game.executeNextTick();

    expect(game.units(UnitType.TradeShip)).toHaveLength(0);
  });

  test("does not expose manual dispatch in legacy economy", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture(false);
    game.addExecution(
      new DispatchTradeRouteExecution(
        sourceOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 3; tick++) game.executeNextTick();

    expect(game.units(UnitType.TradeShip)).toHaveLength(0);
  });

  test("enforces the configured active convoy limit", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture();
    for (let index = 0; index < 3; index++) {
      sourceOwner.buildUnit(UnitType.TradeShip, game.ref(8, 10), {
        targetUnit: destinationPort,
      });
    }
    game.addExecution(
      new DispatchTradeRouteExecution(
        sourceOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 4; tick++) game.executeNextTick();

    expect(sourceOwner.units(UnitType.TradeShip)).toHaveLength(3);
  });

  test("enforces the convoy limit for simultaneous route intents", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture();
    for (let index = 0; index < 5; index++) {
      game.addExecution(
        new DispatchTradeRouteExecution(
          sourceOwner,
          sourcePort.id(),
          destinationPort.id(),
        ),
      );
    }

    for (let tick = 0; tick < 6; tick++) game.executeNextTick();

    expect(sourceOwner.units(UnitType.TradeShip).length).toBeLessThanOrEqual(3);
  });

  test("does not count an active convoy twice against the route limit", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture();

    for (let route = 0; route < 2; route++) {
      const ship = sourceOwner.buildUnit(
        UnitType.TradeShip,
        sourcePort.tile(),
        { targetUnit: destinationPort },
      );
      const execution = new TradeShipExecution(
        sourceOwner,
        sourcePort,
        destinationPort,
      );
      execution.init(game, 0);
      (execution as any).tradeShip = ship;
      game.addExecution(execution);
    }

    const dispatch = new DispatchTradeRouteExecution(
      sourceOwner,
      sourcePort.id(),
      destinationPort.id(),
    );
    expect((dispatch as any).hasRouteCapacity(game)).toBe(true);

    const thirdShip = sourceOwner.buildUnit(
      UnitType.TradeShip,
      sourcePort.tile(),
      { targetUnit: destinationPort },
    );
    const thirdExecution = new TradeShipExecution(
      sourceOwner,
      sourcePort,
      destinationPort,
    );
    thirdExecution.init(game, 0);
    (thirdExecution as any).tradeShip = thirdShip;
    game.addExecution(thirdExecution);

    expect((dispatch as any).hasRouteCapacity(game)).toBe(false);
  });

  test("rejects a destination port under naval blockade", async () => {
    const { game, sourceOwner, sourcePort, destinationPort } =
      await routeFixture();
    const attacker = game.addPlayer(
      new PlayerInfo("blockader", PlayerType.Human, null, "blockader_id"),
    );
    attacker.addGold(1_000_000n);
    attacker.addResource(ProcessedResource.Steel, 100);
    attacker.addResource(ProcessedResource.Fuel, 100);
    const waterTile = [...game.circleSearch(destinationPort.tile(), 8)].find(
      (tile) => game.isWater(tile),
    );
    if (waterTile === undefined)
      throw new Error("destination has no nearby sea");
    for (let index = 0; index < 2; index++) {
      attacker.buildUnit(UnitType.Warship, waterTile, {
        patrolTile: waterTile,
      });
    }
    game.addExecution(
      new DispatchTradeRouteExecution(
        sourceOwner,
        sourcePort.id(),
        destinationPort.id(),
      ),
    );

    for (let tick = 0; tick < 4; tick++) game.executeNextTick();

    expect(game.units(UnitType.TradeShip)).toHaveLength(0);
  });
});
