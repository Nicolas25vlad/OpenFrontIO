import { vi } from "vitest";
import { NAVAL_TRANSPORT } from "../../src/core/configuration/StrategyConfig";
import { AttackExecution } from "../../src/core/execution/AttackExecution";
import { SpawnExecution } from "../../src/core/execution/SpawnExecution";
import { TransportShipExecution } from "../../src/core/execution/TransportShipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { GameUpdateType, UnitUpdate } from "../../src/core/game/GameUpdates";
import { ProcessedResource } from "../../src/core/game/Resources";
import { GameID } from "../../src/core/Schemas";
import { setup } from "../util/Setup";
import { TestConfig } from "../util/TestConfig";

const gameID: GameID = "naval_tank_cargo_test";

async function startNavalGame(): Promise<{
  game: Game;
  attacker: Player;
  defender: Player;
}> {
  const game = await setup("ocean_and_land", {
    strategicEconomy: true,
    infiniteGold: true,
    instantBuild: true,
  });
  const attacker = game.addPlayer(
    new PlayerInfo("attacker", PlayerType.Human, null, "naval_attacker"),
  );
  const defender = game.addPlayer(
    new PlayerInfo("defender", PlayerType.Human, null, "naval_defender"),
  );
  game.addExecution(
    new SpawnExecution(gameID, attacker.info(), game.ref(0, 10)),
    new SpawnExecution(gameID, defender.info(), game.ref(0, 15)),
  );
  game.executeNextTick();
  game.executeNextTick();
  for (let tick = 0; tick < 15; tick++) game.executeNextTick();
  game.addExecution(
    new AttackExecution(100, defender, game.terraNullius().id()),
  );
  game.executeNextTick();
  while (defender.outgoingAttacks().length > 0) game.executeNextTick();
  return { game, attacker, defender };
}

describe("strategic tank cargo on naval attacks", () => {
  it("reserves tanks on departure and carries them into the landing attack", async () => {
    const { game, defender } = await startNavalGame();
    defender.addTroops(25_000);
    defender.addTanks(4);
    const recordMotionPlan = vi.spyOn(game, "recordMotionPlan");
    let observedAttackTanks = 0;
    (game.config() as TestConfig).attackLogic = (input) => {
      observedAttackTanks = input.attacker.tanks ?? 0;
      return { attackerTroopLoss: 0, defenderTroopLoss: 0, tickFraction: 0.01 };
    };

    game.addExecution(
      new TransportShipExecution(defender, game.ref(15, 8), 20_000, 5),
    );
    const departureUpdates = game.executeNextTick();

    const [motionPlan] = recordMotionPlan.mock.calls[0];
    expect(motionPlan.kind).toBe("grid");
    if (motionPlan.kind !== "grid") {
      throw new Error("Expected the transport ship to use a grid motion plan");
    }
    expect(motionPlan.ticksPerStep).toBe(NAVAL_TRANSPORT.ticksPerTile);
    const [ship] = defender.units(UnitType.TransportShip);
    expect(ship).toBeDefined();
    expect(defender.tanks()).toBe(2);
    expect(ship.transportShipState().tanks).toBe(2);
    const shipUpdate = (
      departureUpdates[GameUpdateType.Unit] as UnitUpdate[]
    ).find((update) => update.id === ship.id());
    expect(shipUpdate?.transportShipState?.tanks).toBe(2);

    for (let tick = 0; tick < 300 && ship.isActive(); tick++) {
      game.executeNextTick();
    }
    for (let tick = 0; tick < 3; tick++) game.executeNextTick();

    expect(ship.isActive()).toBe(false);
    expect(observedAttackTanks).toBe(2);
    expect(defender.tanks()).toBeLessThanOrEqual(4);
  });

  it("charges supply for tanks currently loaded on a transport", async () => {
    const { game, defender } = await startNavalGame();
    defender.addTroops(125_000);
    defender.addTanks(10);

    game.addExecution(
      new TransportShipExecution(defender, game.ref(15, 8), 100_000, 10),
    );
    game.executeNextTick();

    const [ship] = defender.units(UnitType.TransportShip);
    expect(ship?.transportShipState().tanks).toBe(10);
    expect(defender.tanks()).toBe(0);
    const fuelBefore = defender.resourceAmount(ProcessedResource.Fuel);

    defender.updateEconomy(10);

    expect(defender.supplyStatus().fuelDemand).toBe(1);
    expect(defender.resourceAmount(ProcessedResource.Fuel)).toBe(
      fuelBefore - 1,
    );
  });

  it("keeps legacy intents without a tank request infantry-only", async () => {
    const { game, defender } = await startNavalGame();
    defender.addTroops(25_000);
    defender.addTanks(3);

    game.addExecution(
      new TransportShipExecution(defender, game.ref(15, 8), 20_000),
    );
    game.executeNextTick();

    const [ship] = defender.units(UnitType.TransportShip);
    expect(ship?.transportShipState().tanks ?? 0).toBe(0);
    expect(defender.tanks()).toBe(3);
  });

  it("returns only surviving tank cargo when a loaded ship retreats", async () => {
    const { game, defender } = await startNavalGame();
    defender.addTroops(25_000);
    defender.addTanks(4);

    game.addExecution(
      new TransportShipExecution(defender, game.ref(15, 8), 20_000, 2),
    );
    game.executeNextTick();
    const [ship] = defender.units(UnitType.TransportShip);
    expect(ship?.transportShipState().tanks).toBe(2);

    ship.updateTransportShipState({ isRetreating: true });
    for (let tick = 0; tick < 300 && ship.isActive(); tick++) {
      game.executeNextTick();
    }

    expect(ship.isActive()).toBe(false);
    expect(defender.tanks()).toBe(3);
  });

  it("does not load tanks in legacy games", async () => {
    const { game, defender } = await startNavalGame();
    (game.config() as TestConfig).strategicEconomy = () => false;
    defender.addTroops(25_000);
    defender.addTanks(3);

    game.addExecution(
      new TransportShipExecution(defender, game.ref(15, 8), 20_000, 2),
    );
    game.executeNextTick();

    const [ship] = defender.units(UnitType.TransportShip);
    expect(ship?.transportShipState().tanks ?? 0).toBe(0);
    expect(defender.tanks()).toBe(3);
  });
});
