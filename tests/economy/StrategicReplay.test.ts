import { Config } from "../../src/core/configuration/Config";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import {
  Game,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { GameUpdateType, HashUpdate } from "../../src/core/game/GameUpdates";
import {
  NaturalResource,
  ProcessedResource,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

async function replayStrategicEconomy(): Promise<{
  hashes: number[];
  enrichedUranium: number;
  minedResource: NaturalResource;
  minedAmount: number;
  tankCount: number;
}> {
  const game: Game = await setup(
    "big_plains",
    {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    },
    [new PlayerInfo("replay", PlayerType.Human, null, "replay_player")],
    undefined,
    Config,
  );
  const player = game.player("replay_player");
  for (let x = 35; x <= 125; x++) {
    for (let y = 35; y <= 65; y++) {
      player.conquer(game.ref(x, y));
    }
  }
  for (const resource of STOCK_RESOURCES) {
    player.addResource(resource, 1000);
  }
  player.addResource(NaturalResource.Uranium, 100);
  player.addResource(ProcessedResource.Fuel, 100);

  for (const [type, x] of [
    [UnitType.City, 45],
    [UnitType.Farm, 65],
    [UnitType.NuclearPlant, 85],
    [UnitType.SupplyCenter, 105],
    [UnitType.VehicleFactory, 125],
  ] as const) {
    game.addExecution(new ConstructionExecution(player, type, game.ref(x, 50)));
  }

  const mineNodes = [...game.resourceNodes()].sort((a, b) => {
    const distanceFromExistingStructures = (node: { x: number; y: number }) =>
      Math.min(
        ...[45, 65, 85, 105, 125].map(
          (x) => (node.x - x) ** 2 + (node.y - 50) ** 2,
        ),
      );
    return (
      distanceFromExistingStructures(b) - distanceFromExistingStructures(a)
    );
  });
  const mineNode = mineNodes[0];
  const mineTile = game.ref(mineNode.x, mineNode.y);
  player.conquer(mineTile);
  game.addExecution(new ConstructionExecution(player, UnitType.Mine, mineTile));

  const hashes: number[] = [];
  for (let tick = 0; tick < 400; tick++) {
    const updates = game.executeNextTick();
    hashes.push(
      ...(updates[GameUpdateType.Hash] as HashUpdate[]).map(
        (update) => update.hash,
      ),
    );
  }

  return {
    hashes,
    enrichedUranium: player.resourceAmount(ProcessedResource.EnrichedUranium),
    minedResource: mineNode.resource,
    minedAmount: player.resourceAmount(mineNode.resource),
    tankCount: player.tanks(),
  };
}

test("strategic economy produces identical replay hashes across simulations", async () => {
  const first = await replayStrategicEconomy();
  const second = await replayStrategicEconomy();

  expect(first.hashes.length).toBeGreaterThan(0);
  expect(first.hashes).toEqual(second.hashes);
  expect(first.enrichedUranium).toBeGreaterThan(0);
  expect(first.enrichedUranium).toBe(second.enrichedUranium);
  expect(first.minedAmount).toBeGreaterThan(1000);
  expect(first.minedResource).toBe(second.minedResource);
  expect(first.minedAmount).toBe(second.minedAmount);
  expect(first.tankCount).toBeGreaterThan(0);
  expect(first.tankCount).toBe(second.tankCount);
});
