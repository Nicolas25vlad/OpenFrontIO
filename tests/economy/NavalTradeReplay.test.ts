import { Config } from "../../src/core/configuration/Config";
import { DispatchTradeRouteExecution } from "../../src/core/execution/DispatchTradeRouteExecution";
import {
  Game,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { GameUpdateType, HashUpdate } from "../../src/core/game/GameUpdates";
import { ProcessedResource } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

async function replayNavalTrade(): Promise<{
  hashes: number[];
  sellerFood: number;
  buyerFood: number;
  sellerGold: bigint;
  buyerGold: bigint;
}> {
  const game: Game = await setup(
    "half_land_half_ocean",
    {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    },
    [
      new PlayerInfo("seller", PlayerType.Human, null, "seller"),
      new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
    ],
    undefined,
    Config,
  );
  game.config().tradeShipSpawnRate = () => 1_000_000;
  const seller = game.player("seller");
  const buyer = game.player("buyer");
  const sourceTile = game.ref(7, 10);
  const destinationTile = game.ref(7, 0);
  seller.conquer(sourceTile);
  buyer.conquer(destinationTile);
  seller.addGold(1_000_000n);
  buyer.addGold(1_000_000n);
  seller.removeResource(
    ProcessedResource.Food,
    seller.resourceAmount(ProcessedResource.Food),
  );
  seller.addResource(ProcessedResource.Food, 125);
  buyer.removeResource(
    ProcessedResource.Food,
    buyer.resourceAmount(ProcessedResource.Food),
  );
  const sourcePort = seller.buildUnit(UnitType.Port, sourceTile, {});
  const destinationPort = buyer.buildUnit(UnitType.Port, destinationTile, {});
  game.endSpawnPhase();
  game.addExecution(
    new DispatchTradeRouteExecution(
      seller,
      sourcePort.id(),
      destinationPort.id(),
    ),
  );

  const hashes: number[] = [];
  let convoyCreated = false;
  for (let tick = 0; tick < 200; tick++) {
    const updates = game.executeNextTick();
    hashes.push(
      ...(updates[GameUpdateType.Hash] as HashUpdate[]).map(
        (update) => update.hash,
      ),
    );
    convoyCreated ||= game.units(UnitType.TradeShip).length > 0;
    if (convoyCreated && game.units(UnitType.TradeShip).length === 0) break;
  }

  return {
    hashes,
    sellerFood: seller.resourceAmount(ProcessedResource.Food),
    buyerFood: buyer.resourceAmount(ProcessedResource.Food),
    sellerGold: seller.gold(),
    buyerGold: buyer.gold(),
  };
}

test("strategic trade routes produce identical replay hashes and cargo", async () => {
  const first = await replayNavalTrade();
  const second = await replayNavalTrade();

  expect(first.hashes.length).toBeGreaterThan(0);
  expect(first.hashes).toEqual(second.hashes);
  expect(first.buyerFood).toBe(5);
  expect(first.sellerFood).toBe(120);
  expect(first.buyerFood).toBe(second.buyerFood);
  expect(first.sellerFood).toBe(second.sellerFood);
  expect(first.sellerGold).toBe(second.sellerGold);
  expect(first.buyerGold).toBe(second.buyerGold);
});
