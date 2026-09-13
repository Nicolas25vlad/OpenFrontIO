import { AttackLogicInput, Config } from "../../src/core/configuration/Config";
import {
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "../../src/core/game/Game";
import { ProcessedResource as Product } from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

test("food shortages soften growth and supply, never create food or charge a period twice", async () => {
  const game = await setup("plains", { strategicEconomy: true }, [
    new PlayerInfo("p", PlayerType.Human, null, "p"),
  ]);
  const p = game.player("p");
  p.conquer(game.ref(40, 40));
  p.setTroops(50_000);
  p.updateEconomy(10);
  expect(p.supplyStatus().infantry).toBe(100);
  const fedGrowth = game.config().troopIncreaseRate(p);
  const after = p.resourceAmount(Product.Food);
  p.updateEconomy(10);
  expect(p.resourceAmount(Product.Food)).toBe(after);
  p.removeResource(Product.Food, after);
  p.updateEconomy(20);
  expect(p.supplyStatus().infantry).toBeLessThan(100);
  const starvingGrowth = game.config().troopIncreaseRate(p);
  expect(starvingGrowth).toBeGreaterThan(0);
  expect(starvingGrowth).toBeLessThan(fedGrowth);
  p.addResource(Product.Food, 1000);
  p.updateEconomy(30);
  expect(p.supplyStatus().infantry).toBe(100);
  expect(p.resourceAmount(Product.Food)).toBeLessThan(1000);
});

test("supply affects attacking strength, defence and speed without changing legacy rules", async () => {
  const game = await setup("plains", { strategicEconomy: true });
  const input: AttackLogicInput = {
    terrain: TerrainType.Plains,
    attackTroops: 20000,
    attacker: { type: PlayerType.Human, numTiles: 1000, supply: 100 },
    defender: {
      type: PlayerType.Human,
      numTiles: 1000,
      troops: 50000,
      isTraitor: false,
      isDisconnectedTeammate: false,
      supply: 100,
    },
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 50,
  };
  const simulate = (i: AttackLogicInput) =>
    Config.prototype.attackLogic.call(game.config(), i);
  const supplied = simulate(input);
  const hungryAttacker = simulate({
    ...input,
    attacker: { ...input.attacker, supply: 0 },
  });
  expect(hungryAttacker.attackerTroopLoss).toBeGreaterThan(
    supplied.attackerTroopLoss,
  );
  expect(hungryAttacker.tickFraction).toBeGreaterThan(supplied.tickFraction);
  const hungryDefender = simulate({
    ...input,
    defender: { ...input.defender!, supply: 0 },
  });
  expect(hungryDefender.defenderTroopLoss).toBeGreaterThan(
    supplied.defenderTroopLoss,
  );
});

test("gold reserves bridge a cash shortage in bounded conversions; disabled games ignore it", async () => {
  for (const enabled of [true, false]) {
    const game = await setup("plains", { strategicEconomy: enabled }, [
      new PlayerInfo("p", PlayerType.Human, null, "p"),
    ]);
    const p = game.player("p");
    p.conquer(game.ref(40, 40));
    p.removeGold(p.gold());
    p.addResource(Product.GoldBars, 100);
    p.updateEconomy(10);
    expect(p.gold() > 0n).toBe(enabled);
    expect(p.resourceAmount(Product.GoldBars)).toBe(enabled ? 99 : 100);
    p.addGold(1_000_000n);
    const gold = p.gold();
    p.updateEconomy(20);
    expect(p.gold()).toBe(gold);
    expect(game.config().resourceCost(UnitType.Factory)).toEqual({});
  }
});
