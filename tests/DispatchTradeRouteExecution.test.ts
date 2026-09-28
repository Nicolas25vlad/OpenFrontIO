import { DispatchTradeRouteExecution } from "../src/core/execution/DispatchTradeRouteExecution";
import { PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
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
});
