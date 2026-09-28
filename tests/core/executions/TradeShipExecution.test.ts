import { NAVAL_TRADE } from "../../../src/core/configuration/StrategyConfig";
import {
  selectStrategicCargo,
  TradeShipExecution,
} from "../../../src/core/execution/TradeShipExecution";
import {
  Game,
  MessageType,
  Player,
  PlayerInfo,
  PlayerType,
  Unit,
  UnitType,
} from "../../../src/core/game/Game";
import {
  NaturalResource,
  ProcessedResource,
  ResourceType,
  STOCK_RESOURCES,
} from "../../../src/core/game/Resources";
import { PathStatus } from "../../../src/core/pathfinding/types";
import { setup } from "../../util/Setup";

describe("TradeShipExecution", () => {
  let game: Game;
  let origOwner: Player;
  let dstOwner: Player;
  let pirate: Player;
  let srcPort: Unit;
  let piratePort: Unit;
  let piratePort2: Unit;
  let tradeShip: Unit;
  let dstPort: Unit;
  let tradeShipExecution: TradeShipExecution;

  beforeEach(async () => {
    // Mock Game, Player, Unit, and required methods

    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
    });
    game.displayMessage = vi.fn();
    origOwner = {
      canBuild: vi.fn(() => true),
      buildUnit: vi.fn((type, spawn, opts) => tradeShip),
      displayName: vi.fn(() => "Origin"),
      addGold: vi.fn(),
      addTradeGold: vi.fn(),
      addPiracyGold: vi.fn(),
      units: vi.fn(() => [dstPort]),
      unitCount: vi.fn(() => 1),
      id: vi.fn(() => 1),
      clientID: vi.fn(() => 1),
      canTrade: vi.fn(() => true),
    } as any;

    dstOwner = {
      id: vi.fn(() => 2),
      addGold: vi.fn(),
      addTradeGold: vi.fn(),
      addPiracyGold: vi.fn(),
      displayName: vi.fn(() => "Destination"),
      units: vi.fn(() => [dstPort]),
      unitCount: vi.fn(() => 1),
      clientID: vi.fn(() => 2),
      canTrade: vi.fn(() => true),
    } as any;

    pirate = {
      id: vi.fn(() => 3),
      clientID: vi.fn(() => 3),
      addGold: vi.fn(),
      addTradeGold: vi.fn(),
      addPiracyGold: vi.fn(),
      displayName: vi.fn(() => "Destination"),
      units: vi.fn(() => [piratePort, piratePort2]),
      unitCount: vi.fn(() => 2),
      canTrade: vi.fn(() => true),
    } as any;

    piratePort = {
      id: vi.fn(() => 201),
      tile: vi.fn(() => 56),
      owner: vi.fn(() => pirate),
      isActive: vi.fn(() => true),
      isUnderConstruction: vi.fn(() => false),
      isMarkedForDeletion: vi.fn(() => false),
    } as any;

    piratePort2 = {
      id: vi.fn(() => 202),
      tile: vi.fn(() => 75),
      owner: vi.fn(() => pirate),
      isActive: vi.fn(() => true),
      isUnderConstruction: vi.fn(() => false),
      isMarkedForDeletion: vi.fn(() => false),
    } as any;

    srcPort = {
      id: vi.fn(() => 101),
      tile: vi.fn(() => 10),
      owner: vi.fn(() => origOwner),
      isActive: vi.fn(() => true),
      isUnderConstruction: vi.fn(() => false),
      isMarkedForDeletion: vi.fn(() => false),
    } as any;

    dstPort = {
      id: vi.fn(() => 102),
      tile: vi.fn(() => 100),
      owner: vi.fn(() => dstOwner),
      isActive: vi.fn(() => true),
      isUnderConstruction: vi.fn(() => false),
      isMarkedForDeletion: vi.fn(() => false),
    } as any;

    tradeShip = {
      isActive: vi.fn(() => true),
      owner: vi.fn(() => origOwner),
      id: vi.fn(() => 123),
      move: vi.fn(),
      setTargetUnit: vi.fn(),
      setSafeFromPirates: vi.fn(),
      touch: vi.fn(),
      delete: vi.fn(),
      tile: vi.fn(() => 32),
    } as any;

    tradeShipExecution = new TradeShipExecution(origOwner, srcPort, dstPort);
    tradeShipExecution.init(game, 0);
    tradeShipExecution["pathFinder"] = {
      next: vi.fn(() => ({ status: PathStatus.NEXT, node: 32 })),
      findPath: vi.fn((from: number) => [from]),
      pathForTraversal: vi.fn(() => [32]),
    } as any;
    tradeShipExecution["tradeShip"] = tradeShip;
  });

  it("should initialize and tick without errors", () => {
    const pathFinder = tradeShipExecution["pathFinder"];
    tradeShipExecution.tick(1);
    expect(tradeShipExecution.isActive()).toBe(true);
    expect(pathFinder.pathForTraversal).toHaveBeenCalledOnce();
    expect(pathFinder.findPath).not.toHaveBeenCalled();
  });

  it("should deactivate if tradeShip is not active", () => {
    tradeShip.isActive = vi.fn(() => false);
    tradeShipExecution.tick(1);
    expect(tradeShipExecution.isActive()).toBe(false);
  });

  it("should delete ship if port owner changes to current owner", () => {
    dstPort.owner = vi.fn(() => origOwner);
    tradeShipExecution.tick(1);
    expect(tradeShip.delete).toHaveBeenCalledWith(false);
    expect(tradeShipExecution.isActive()).toBe(false);
  });

  it("should pick another port if ship is captured", () => {
    tradeShip.owner = vi.fn(() => pirate);
    tradeShipExecution.tick(1);
    expect(tradeShip.setTargetUnit).toHaveBeenCalledWith(piratePort);
  });

  it("should notify the original owner when the ship is captured", () => {
    tradeShip.owner = vi.fn(() => pirate);
    tradeShipExecution.tick(1);
    expect(game.displayMessage).toHaveBeenCalledWith(
      "events_display.trade_ship_captured",
      MessageType.UNIT_DESTROYED,
      origOwner.id(),
      undefined,
      { name: pirate.displayName() },
      tradeShip.id(),
      pirate.id(),
    );
  });

  it("should only notify the original owner once across ticks", () => {
    tradeShip.owner = vi.fn(() => pirate);
    tradeShipExecution.tick(1);
    tradeShipExecution.tick(2);
    expect(game.displayMessage).toHaveBeenCalledTimes(1);
  });

  it("should complete trade and award gold", () => {
    tradeShipExecution["pathFinder"] = {
      next: vi.fn(() => ({ status: PathStatus.COMPLETE, node: 32 })),
      findPath: vi.fn((from: number) => [from]),
      pathForTraversal: vi.fn(() => [32]),
    } as any;
    tradeShipExecution.tick(1);
    expect(tradeShip.delete).toHaveBeenCalledWith(false);
    expect(tradeShipExecution.isActive()).toBe(false);
    expect(origOwner.addGold).toHaveBeenCalled();
    expect(dstOwner.addGold).toHaveBeenCalled();
    // Both port owners earn ship-trade revenue (live gold-rate columns).
    expect(origOwner.addTradeGold).toHaveBeenCalled();
    expect(dstOwner.addTradeGold).toHaveBeenCalled();
    // A normal arrival is trade, not piracy.
    expect(origOwner.addPiracyGold).not.toHaveBeenCalled();
    expect(dstOwner.addPiracyGold).not.toHaveBeenCalled();
  });

  it("should count captured-ship payout as piracy revenue only", () => {
    // Captured ships pay steal gold to the captor — GOLD_INDEX_STEAL
    // semantics: piracy revenue, distinct from trade revenue.
    tradeShip.owner = vi.fn(() => pirate);
    tradeShipExecution["pathFinder"] = {
      next: vi.fn(() => ({ status: PathStatus.COMPLETE, node: 32 })),
      findPath: vi.fn((from: number) => [from]),
      pathForTraversal: vi.fn(() => [32]),
    } as any;
    tradeShipExecution.tick(1);
    expect(pirate.addGold).toHaveBeenCalled();
    expect(pirate.addPiracyGold).toHaveBeenCalled();
    expect(pirate.addTradeGold).not.toHaveBeenCalled();
  });
});

describe("strategic trade cargo", () => {
  async function tradeFixture() {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: false, instantBuild: true },
      [
        new PlayerInfo("seller", PlayerType.Human, null, "seller"),
        new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
      ],
    );
    const seller = game.player("seller");
    const buyer = game.player("buyer");
    buyer.addGold(100_000n);
    return {
      game,
      seller,
      buyer,
    };
  }

  function setResourceAmount(
    player: Player,
    resource: ResourceType,
    amount: number,
  ) {
    const current = player.resourceAmount(resource);
    if (current > amount) player.removeResource(resource, current - amount);
    else if (current < amount) player.addResource(resource, amount - current);
  }

  it.each(NAVAL_TRADE.cargoOrder)(
    "honors export reserves and import targets for %s",
    async (resource) => {
      const game = await setup(
        "big_plains",
        { strategicEconomy: true, infiniteGold: true, instantBuild: true },
        [
          new PlayerInfo("seller", PlayerType.Human, null, "seller"),
          new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
        ],
      );
      const seller = game.player("seller");
      const buyer = game.player("buyer");
      const sourceTile = game.ref(10, 10);
      const destinationTile = game.ref(150, 150);
      seller.conquer(sourceTile);
      buyer.conquer(destinationTile);
      seller.addGold(100_000n);
      buyer.addGold(100_000n);
      const sourcePort = seller.buildUnit(UnitType.Port, sourceTile, {});
      const destinationPort = buyer.buildUnit(
        UnitType.Port,
        destinationTile,
        {},
      );

      for (const candidate of NAVAL_TRADE.cargoOrder) {
        const reserve = NAVAL_TRADE.exportReserve[candidate];
        const sellerAmount = seller.resourceAmount(candidate);
        if (sellerAmount > reserve) {
          seller.removeResource(candidate, sellerAmount - reserve);
        } else if (sellerAmount < reserve) {
          seller.addResource(candidate, reserve - sellerAmount);
        }

        const buyerTarget =
          candidate === resource
            ? NAVAL_TRADE.importTarget[candidate] - NAVAL_TRADE.cargoUnits
            : NAVAL_TRADE.importTarget[candidate];
        const buyerAmount = buyer.resourceAmount(candidate);
        if (buyerAmount > buyerTarget) {
          buyer.removeResource(candidate, buyerAmount - buyerTarget);
        } else if (buyerAmount < buyerTarget) {
          buyer.addResource(candidate, buyerTarget - buyerAmount);
        }
      }
      seller.addResource(resource, NAVAL_TRADE.cargoUnits);
      const sellerGoldBefore = seller.gold();
      const buyerGoldBefore = buyer.gold();
      const expectedPayment =
        BigInt(NAVAL_TRADE.cargoUnits) * NAVAL_TRADE.cargoPricePerUnit;
      const routeRevenue = game.config().tradeShipGold(0, seller);
      const execution = new TradeShipExecution(
        seller,
        sourcePort,
        destinationPort,
      );
      execution.init(game, 0);
      execution["pathFinder"] = {
        next: vi.fn(() => ({
          status: PathStatus.COMPLETE,
          node: destinationTile,
        })),
      } as any;

      execution.tick(1);

      expect(seller.resourceAmount(resource)).toBe(
        NAVAL_TRADE.exportReserve[resource],
      );
      expect(buyer.resourceAmount(resource)).toBe(
        NAVAL_TRADE.importTarget[resource],
      );
      expect(seller.gold()).toBe(
        sellerGoldBefore + expectedPayment + routeRevenue,
      );
      expect(buyer.gold()).toBe(
        buyerGoldBefore - expectedPayment + routeRevenue,
      );
    },
  );

  test("ships the proportionally scarcer resource before the configured tie-break order", async () => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("seller", PlayerType.Human, null, "seller"),
        new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
      ],
    );
    const seller = game.player("seller");
    const buyer = game.player("buyer");
    const sourceTile = game.ref(10, 10);
    const destinationTile = game.ref(150, 150);
    seller.conquer(sourceTile);
    buyer.conquer(destinationTile);
    seller.addGold(100_000n);
    buyer.addGold(100_000n);

    for (const resource of NAVAL_TRADE.cargoOrder) {
      seller.removeResource(resource, seller.resourceAmount(resource));
      buyer.removeResource(resource, buyer.resourceAmount(resource));
      seller.addResource(resource, NAVAL_TRADE.exportReserve[resource]);
      buyer.addResource(resource, NAVAL_TRADE.importTarget[resource]);
    }
    seller.addResource(ProcessedResource.Food, NAVAL_TRADE.cargoUnits);
    seller.addResource(ProcessedResource.Fuel, NAVAL_TRADE.cargoUnits);
    buyer.removeResource(
      ProcessedResource.Food,
      buyer.resourceAmount(ProcessedResource.Food) -
        (NAVAL_TRADE.importTarget[ProcessedResource.Food] - 60),
    );
    buyer.removeResource(
      ProcessedResource.Fuel,
      buyer.resourceAmount(ProcessedResource.Fuel),
    );

    const sourcePort = seller.buildUnit(UnitType.Port, sourceTile, {});
    const destinationPort = buyer.buildUnit(UnitType.Port, destinationTile, {});
    const execution = new TradeShipExecution(
      seller,
      sourcePort,
      destinationPort,
    );
    execution.init(game, 0);
    execution["pathFinder"] = {
      next: vi.fn(() => ({
        status: PathStatus.COMPLETE,
        node: destinationTile,
      })),
    } as any;

    execution.tick(1);

    expect(seller.resourceAmount(ProcessedResource.Fuel)).toBe(
      NAVAL_TRADE.exportReserve[ProcessedResource.Fuel],
    );
    expect(buyer.resourceAmount(ProcessedResource.Fuel)).toBe(
      NAVAL_TRADE.cargoUnits,
    );
    expect(seller.resourceAmount(ProcessedResource.Food)).toBe(
      NAVAL_TRADE.exportReserve[ProcessedResource.Food] +
        NAVAL_TRADE.cargoUnits,
    );
    expect(buyer.resourceAmount(ProcessedResource.Food)).toBe(
      NAVAL_TRADE.importTarget[ProcessedResource.Food] - 60,
    );
  });

  test("moves scarce supplies and pays the exporter when the convoy arrives", async () => {
    const game = await setup(
      "big_plains",
      {
        strategicEconomy: true,
        infiniteGold: true,
        instantBuild: true,
      },
      [
        new PlayerInfo("seller", PlayerType.Human, null, "seller"),
        new PlayerInfo("buyer", PlayerType.Human, null, "buyer"),
      ],
    );
    const seller = game.player("seller");
    const buyer = game.player("buyer");
    const reserves: Record<
      ProcessedResource.Food | ProcessedResource.Fuel | ProcessedResource.Steel,
      number
    > = {
      [ProcessedResource.Food]: 120,
      [ProcessedResource.Fuel]: 30,
      [ProcessedResource.Steel]: 40,
    };
    for (const resource of NAVAL_TRADE.cargoOrder) {
      setResourceAmount(seller, resource, NAVAL_TRADE.exportReserve[resource]);
      setResourceAmount(buyer, resource, NAVAL_TRADE.importTarget[resource]);
    }
    const tradedResources: (
      | ProcessedResource.Food
      | ProcessedResource.Fuel
      | ProcessedResource.Steel
    )[] = [
      ProcessedResource.Food,
      ProcessedResource.Fuel,
      ProcessedResource.Steel,
    ];
    const sourceTile = game.ref(10, 10);
    const destinationTile = game.ref(150, 150);
    seller.conquer(sourceTile);
    buyer.conquer(destinationTile);
    seller.addGold(100_000n);
    buyer.addGold(100_000n);
    const sourcePort = seller.buildUnit(UnitType.Port, sourceTile, {});
    const destinationPort = buyer.buildUnit(UnitType.Port, destinationTile, {});
    for (const resource of tradedResources) {
      const sellerAmount = seller.resourceAmount(resource);
      if (sellerAmount > reserves[resource]) {
        seller.removeResource(resource, sellerAmount - reserves[resource]);
      } else if (sellerAmount < reserves[resource]) {
        seller.addResource(resource, reserves[resource] - sellerAmount);
      }
      buyer.removeResource(resource, buyer.resourceAmount(resource));
    }
    seller.addResource(ProcessedResource.Food, 100);
    const sellerFoodBefore = seller.resourceAmount(ProcessedResource.Food);
    const sellerGoldBefore = seller.gold();
    const buyerGoldBefore = buyer.gold();
    const routeRevenue = game.config().tradeShipGold(0, seller);
    const execution = new TradeShipExecution(
      seller,
      sourcePort,
      destinationPort,
    );
    execution.init(game, 0);
    execution["pathFinder"] = {
      next: vi.fn(() => ({
        status: PathStatus.COMPLETE,
        node: destinationTile,
      })),
    } as any;

    execution.tick(1);

    expect(seller.resourceAmount(ProcessedResource.Food)).toBe(
      sellerFoodBefore - 5,
    );
    expect(buyer.resourceAmount(ProcessedResource.Food)).toBe(5);
    expect(buyer.gold()).toBe(buyerGoldBefore - 500n + routeRevenue);
    expect(seller.gold()).toBe(sellerGoldBefore + 500n + routeRevenue);

    seller.removeResource(
      ProcessedResource.Food,
      seller.resourceAmount(ProcessedResource.Food) -
        reserves[ProcessedResource.Food],
    );
    buyer.removeResource(
      ProcessedResource.Food,
      buyer.resourceAmount(ProcessedResource.Food),
    );
    const buyerGoldWithoutSurplus = buyer.gold();
    const secondTrade = new TradeShipExecution(
      seller,
      sourcePort,
      destinationPort,
    );
    secondTrade.init(game, 2);
    secondTrade["pathFinder"] = {
      next: vi.fn(() => ({
        status: PathStatus.COMPLETE,
        node: destinationTile,
      })),
    } as any;
    secondTrade.tick(3);

    expect(seller.resourceAmount(ProcessedResource.Food)).toBe(120);
    expect(buyer.resourceAmount(ProcessedResource.Food)).toBe(0);
    expect(buyer.gold()).toBe(
      buyerGoldWithoutSurplus + game.config().tradeShipGold(0, seller),
    );

    seller.addResource(ProcessedResource.Food, 5);
    const buyerGoldBeforeCanceledRoute = buyer.gold();
    const canceledTrade = new TradeShipExecution(
      seller,
      sourcePort,
      destinationPort,
    );
    canceledTrade.init(game, 4);
    canceledTrade["pathFinder"] = {
      next: vi.fn(() => ({ status: PathStatus.NEXT, node: 32 })),
      pathForTraversal: vi.fn(() => [32]),
    } as any;
    canceledTrade.tick(5);
    expect(buyer.gold()).toBe(buyerGoldBeforeCanceledRoute - 500n);
    seller.captureUnit(destinationPort);
    canceledTrade.tick(6);

    expect(seller.resourceAmount(ProcessedResource.Food)).toBe(125);
    expect(buyer.gold()).toBe(buyerGoldBeforeCanceledRoute);

    buyer.captureUnit(destinationPort);
    const buyerGoldBeforeCapture = buyer.gold();
    const sellerGoldBeforeCapture = seller.gold();
    const capturedTrade = new TradeShipExecution(
      seller,
      sourcePort,
      destinationPort,
    );
    capturedTrade.init(game, 7);
    capturedTrade["pathFinder"] = {
      next: vi.fn(() => ({ status: PathStatus.NEXT, node: 32 })),
      pathForTraversal: vi.fn(() => [32]),
    } as any;
    capturedTrade.tick(8);
    expect(buyer.gold()).toBe(buyerGoldBeforeCapture - 500n);
    const cargoShip = game.units(UnitType.TradeShip)[0];
    buyer.captureUnit(cargoShip);
    capturedTrade["pathFinder"] = {
      next: vi.fn(() => ({
        status: PathStatus.COMPLETE,
        node: destinationTile,
      })),
    } as any;
    capturedTrade.tick(9);

    expect(buyer.resourceAmount(ProcessedResource.Food)).toBe(5);
    expect(buyer.gold()).toBe(
      buyerGoldBeforeCapture + game.config().tradeShipGold(1, buyer),
    );
    expect(seller.resourceAmount(ProcessedResource.Food)).toBe(120);
    expect(seller.gold()).toBe(sellerGoldBeforeCapture);
  });

  test("reports no deficit, no supplier stock, and insufficient buyer funds", async () => {
    const { seller, buyer } = await tradeFixture();
    for (const resource of STOCK_RESOURCES) {
      setResourceAmount(seller, resource, NAVAL_TRADE.exportReserve[resource]);
      setResourceAmount(buyer, resource, NAVAL_TRADE.importTarget[resource]);
    }
    expect(selectStrategicCargo(seller, buyer)).toEqual({
      kind: "unavailable",
      reason: "no-deficit",
    });

    for (const resource of STOCK_RESOURCES)
      setResourceAmount(buyer, resource, 0);
    expect(selectStrategicCargo(seller, buyer)).toEqual({
      kind: "unavailable",
      reason: "no-surplus",
    });

    for (const resource of NAVAL_TRADE.cargoOrder) {
      setResourceAmount(
        seller,
        resource,
        NAVAL_TRADE.exportReserve[resource] + NAVAL_TRADE.cargoUnits,
      );
    }
    buyer.removeGold(buyer.gold());
    expect(selectStrategicCargo(seller, buyer)).toEqual({
      kind: "unavailable",
      reason: "insufficient-funds",
    });
  });

  test("caps cargo at available export stock and supports raw and processed goods", async () => {
    const { seller, buyer } = await tradeFixture();
    for (const resource of STOCK_RESOURCES) {
      setResourceAmount(seller, resource, NAVAL_TRADE.exportReserve[resource]);
      setResourceAmount(buyer, resource, NAVAL_TRADE.importTarget[resource]);
    }
    setResourceAmount(buyer, NaturalResource.Oil, 0);
    setResourceAmount(
      seller,
      NaturalResource.Oil,
      NAVAL_TRADE.exportReserve[NaturalResource.Oil] + 2,
    );
    const rawOffer = selectStrategicCargo(seller, buyer);
    expect(rawOffer.kind).toBe("available");
    if (rawOffer.kind !== "available") throw new Error("raw offer missing");
    expect(rawOffer.resource).toBe(NaturalResource.Oil);
    expect(rawOffer.amount).toBe(2);

    setResourceAmount(
      seller,
      NaturalResource.Oil,
      NAVAL_TRADE.exportReserve[NaturalResource.Oil],
    );
    setResourceAmount(
      buyer,
      NaturalResource.Oil,
      NAVAL_TRADE.importTarget[NaturalResource.Oil],
    );
    setResourceAmount(buyer, ProcessedResource.Circuits, 0);
    setResourceAmount(
      seller,
      ProcessedResource.Circuits,
      NAVAL_TRADE.exportReserve[ProcessedResource.Circuits] + 4,
    );
    const processedOffer = selectStrategicCargo(seller, buyer);
    expect(processedOffer.kind).toBe("available");
    if (processedOffer.kind !== "available")
      throw new Error("processed offer missing");
    expect(processedOffer.resource).toBe(ProcessedResource.Circuits);
  });
});
