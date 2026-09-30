import { Config } from "../../src/core/configuration/Config";
import { ECONOMY } from "../../src/core/configuration/StrategyConfig";
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

test("troops, ships and tanks have no recurring resource upkeep", async () => {
  const game = await setup("plains", { strategicEconomy: true }, [
    new PlayerInfo("p", PlayerType.Human, null, "p"),
  ]);
  const player = game.player("p");
  const tile = game.ref(40, 40);
  player.conquer(tile);
  player.addGold(1_000_000_000n);
  player.setTroops(100_000);
  player.addTanks(50);
  player.buildUnit(UnitType.Warship, tile, { patrolTile: tile });

  for (const resource of [
    ProcessedResource.Food,
    ProcessedResource.Fuel,
    ProcessedResource.Steel,
  ]) {
    player.removeResource(resource, player.resourceAmount(resource));
    player.addResource(resource, 100);
  }
  player.finishResourcePeriod();
  const stockBefore = { ...player.resourceStock() };

  player.updateEconomy(ECONOMY.periodTicks);
  player.finishResourcePeriod();

  expect(player.resourceStock()).toEqual(stockBefore);
  expect(player.resourceRates().consumption[ProcessedResource.Food]).toBe(0);
  expect(player.resourceRates().consumption[ProcessedResource.Fuel]).toBe(0);
  expect(player.resourceRates().consumption[ProcessedResource.Steel]).toBe(0);
});

test("army growth does not depend on food stock", async () => {
  const game = await setup("plains", { strategicEconomy: true }, [
    new PlayerInfo("p", PlayerType.Human, null, "p"),
  ]);
  const player = game.player("p");
  player.conquer(game.ref(40, 40));
  player.setTroops(50_000);
  const growthWithFood = game.config().troopIncreaseRate(player);

  player.removeResource(
    ProcessedResource.Food,
    player.resourceAmount(ProcessedResource.Food),
  );

  expect(game.config().troopIncreaseRate(player)).toBe(growthWithFood);
});

test("connected logistics still improves attack advance speed", async () => {
  const game = await setup("plains", { strategicEconomy: true });
  const config = game.config();
  const input = {
    terrain: TerrainType.Plains,
    attackTroops: 50_000,
    attacker: { type: PlayerType.Human, numTiles: 1_000 },
    defender: {
      type: PlayerType.Human,
      numTiles: 1_000,
      troops: 50_000,
      isTraitor: false,
      isDisconnectedTeammate: false,
    },
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 50,
  } as const;
  const withoutLogistics = Config.prototype.attackLogic.call(config, input);
  const withLogistics = Config.prototype.attackLogic.call(config, {
    ...input,
    attacker: { ...input.attacker, logistics: 25 },
  });

  expect(withLogistics.tickFraction).toBeLessThan(
    withoutLogistics.tickFraction,
  );
});
