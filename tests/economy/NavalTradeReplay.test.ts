import { Config } from "../../src/core/configuration/Config";
import { NAVAL_TRADE } from "../../src/core/configuration/StrategyConfig";
import { PortExecution } from "../../src/core/execution/PortExecution";
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
  sellerFuel: number;
  buyerFuel: number;
  sellerGold: bigint;
  buyerGold: bigint;
  sellerTradeGold: bigint;
  buyerTradeGold: bigint;
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
  game.config().tradeShipSpawnRate = () => 1;
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
  seller.removeResource(
    ProcessedResource.Fuel,
    seller.resourceAmount(ProcessedResource.Fuel),
  );
  seller.addResource(
    ProcessedResource.Fuel,
    NAVAL_TRADE.exportReserve[ProcessedResource.Fuel] + NAVAL_TRADE.cargoUnits,
  );
  buyer.removeResource(
    ProcessedResource.Fuel,
    buyer.resourceAmount(ProcessedResource.Fuel),
  );
  const sourcePort = seller.buildUnit(UnitType.Port, sourceTile, {});
  const destinationPort = buyer.buildUnit(UnitType.Port, destinationTile, {});
  game.endSpawnPhase();
  const portExecution = new PortExecution(destinationPort);
  portExecution.init(game, game.ticks());
  if (!portExecution.supplierPorts().includes(sourcePort)) {
    throw new Error("the buyer port should select the available supplier");
  }
  game.addExecution(portExecution);

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
    sellerFuel: seller.resourceAmount(ProcessedResource.Fuel),
    buyerFuel: buyer.resourceAmount(ProcessedResource.Fuel),
    sellerGold: seller.gold(),
    buyerGold: buyer.gold(),
    sellerTradeGold: seller.tradeGold(),
    buyerTradeGold: buyer.tradeGold(),
  };
}

test("automatically imports cargo and replays identically", async () => {
  const first = await replayNavalTrade();
  const second = await replayNavalTrade();

  expect(first.hashes.length).toBeGreaterThan(0);
  expect(first.hashes).toEqual(second.hashes);
  expect(first.buyerFuel).toBe(NAVAL_TRADE.cargoUnits);
  expect(first.sellerFuel).toBe(
    NAVAL_TRADE.exportReserve[ProcessedResource.Fuel],
  );
  expect(first.buyerFood).toBe(
    NAVAL_TRADE.importTarget[ProcessedResource.Food],
  );
  expect(first.sellerFood).toBe(125);
  expect(first.buyerFood).toBe(second.buyerFood);
  expect(first.sellerFood).toBe(second.sellerFood);
  expect(first.buyerFuel).toBe(second.buyerFuel);
  expect(first.sellerFuel).toBe(second.sellerFuel);
  expect(first.sellerGold).toBe(second.sellerGold);
  expect(first.buyerGold).toBe(second.buyerGold);
  expect(first.sellerTradeGold).toBe(second.sellerTradeGold);
  expect(first.buyerTradeGold).toBe(second.buyerTradeGold);
});
