import { AttackLogicInput, Config } from "../../src/core/configuration/Config";
import { STRATEGIC_COMBAT } from "../../src/core/configuration/StrategyConfig";
import { PlayerType, TerrainType } from "../../src/core/game/Game";
import { UserSettings } from "../../src/core/game/UserSettings";
import { testGameConfig } from "../util/Wire";

test("Anti-ICBM range and throughput bonuses preserve all legacy levels", () => {
  const legacy = new Config(testGameConfig(), new UserSettings(), false);
  const strategic = new Config(
    testGameConfig({ strategicEconomy: true }),
    new UserSettings(),
    false,
  );
  for (const level of [1, 2, 5, 10, 100]) {
    expect(strategic.samRange(level)).toBeCloseTo(legacy.samRange(level) * 1.2);
  }
  expect(strategic.defaultSamRange()).toBe(84);
  expect(strategic.maxSamRange()).toBe(180);
  expect(strategic.SAMCooldown()).toBe(Math.ceil(legacy.SAMCooldown() / 1.15));
  expect(strategic.defensePostDefenseBonus()).toBeGreaterThan(
    legacy.defensePostDefenseBonus(),
  );
  expect(strategic.defensePostSpeedBonus()).toBeGreaterThan(
    legacy.defensePostSpeedBonus(),
  );
  expect(strategic.defensePostDefenseBonus(2)).toBeGreaterThan(
    strategic.defensePostDefenseBonus(1),
  );
  expect(strategic.defensePostSpeedBonus(3)).toBeGreaterThan(
    strategic.defensePostSpeedBonus(1),
  );
  expect(legacy.defensePostDefenseBonus(3)).toBe(
    legacy.defensePostDefenseBonus(1),
  );

  const attack: AttackLogicInput = {
    terrain: TerrainType.Plains,
    attackTroops: 50_000,
    attacker: { type: PlayerType.Human, numTiles: 20_000 },
    defender: {
      type: PlayerType.Human,
      numTiles: 20_000,
      troops: 50_000,
      isTraitor: false,
      isDisconnectedTeammate: false,
    },
    defenderHasDefensePost: true,
    defenderDefensePostLevel: 1,
    falloutRatio: null,
    borderSize: 100,
  };
  const levelOne = strategic.attackLogic(attack);
  const levelThree = strategic.attackLogic({
    ...attack,
    defenderDefensePostLevel: 3,
  });
  expect(levelThree.attackerTroopLoss).toBeGreaterThan(
    levelOne.attackerTroopLoss,
  );
  expect(levelThree.tickFraction).toBeGreaterThan(levelOne.tickFraction);

  const noTrench = strategic.attackLogic({
    ...attack,
    defenderHasDefensePost: false,
    defenderDefensePostLevel: 0,
  });
  const levelThreeTrench = strategic.attackLogic({
    ...attack,
    defenderHasDefensePost: false,
    defenderDefensePostLevel: 0,
    defenderTrenchLevel: 3,
  });
  expect(levelThreeTrench.attackerTroopLoss).toBeGreaterThan(
    noTrench.attackerTroopLoss,
  );
  expect(levelThreeTrench.tickFraction).toBeGreaterThan(noTrench.tickFraction);

  const entrenchedStaging = strategic.attackLogic({
    ...attack,
    defenderHasDefensePost: false,
    defenderDefensePostLevel: 0,
    attacker: { ...attack.attacker, trenchLevel: 3 },
  });
  expect(entrenchedStaging.attackerTroopLoss).toBeGreaterThan(
    noTrench.attackerTroopLoss,
  );
  expect(entrenchedStaging.tickFraction).toBeGreaterThan(noTrench.tickFraction);

  const tankBreakthroughBase = {
    ...attack,
    attackTroops: 550_000,
    defenderHasDefensePost: false,
    defenderDefensePostLevel: 0,
    attacker: { ...attack.attacker, tanks: 100 },
  };
  const tankBreakthroughWithoutTrench =
    strategic.attackLogic(tankBreakthroughBase);
  const tankBreakthroughFromTrench = strategic.attackLogic({
    ...tankBreakthroughBase,
    attacker: { ...tankBreakthroughBase.attacker, trenchLevel: 3 },
  });
  expect(
    tankBreakthroughFromTrench.attackerTroopLoss -
      tankBreakthroughWithoutTrench.attackerTroopLoss,
  ).toBeLessThan(
    entrenchedStaging.attackerTroopLoss - noTrench.attackerTroopLoss,
  );
  expect(
    tankBreakthroughFromTrench.tickFraction -
      tankBreakthroughWithoutTrench.tickFraction,
  ).toBeLessThan(entrenchedStaging.tickFraction - noTrench.tickFraction);

  expect(legacy.attackLogic({ ...attack, defenderTrenchLevel: 3 })).toEqual(
    legacy.attackLogic(attack),
  );
  expect(
    legacy.attackLogic({
      ...attack,
      attacker: { ...attack.attacker, trenchLevel: 3 },
    }),
  ).toEqual(legacy.attackLogic(attack));
});

test("strategic tanks improve land-attack advance speed up to the configured cap", () => {
  const legacy = new Config(testGameConfig(), new UserSettings(), false);
  const strategic = new Config(
    testGameConfig({ strategicEconomy: true }),
    new UserSettings(),
    false,
  );
  const attack: AttackLogicInput = {
    terrain: TerrainType.Plains,
    attackTroops: 50_000,
    attacker: { type: PlayerType.Human, numTiles: 10_000 },
    defender: {
      type: PlayerType.Human,
      numTiles: 10_000,
      troops: 50_000,
      isTraitor: false,
      isDisconnectedTeammate: false,
    },
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 100,
  };
  const infantryOnly = strategic.attackLogic(attack);
  const oneTank = strategic.attackLogic({
    ...attack,
    attackTroops: 55_000,
    attacker: { ...attack.attacker, tanks: 1 },
  });
  const cappedTanks = strategic.attackLogic({
    ...attack,
    attackTroops: 550_000,
    attacker: { ...attack.attacker, tanks: 100 },
  });
  const atCap = strategic.attackLogic({
    ...attack,
    attackTroops:
      50_000 +
      Math.ceil(
        STRATEGIC_COMBAT.tankAdvanceSpeedMaxPercent /
          STRATEGIC_COMBAT.tankAdvanceSpeedPerTankPercent,
      ) *
        STRATEGIC_COMBAT.tankCombatPower,
    attacker: {
      ...attack.attacker,
      tanks: Math.ceil(
        STRATEGIC_COMBAT.tankAdvanceSpeedMaxPercent /
          STRATEGIC_COMBAT.tankAdvanceSpeedPerTankPercent,
      ),
    },
  });

  expect(oneTank.tickFraction).toBeLessThan(infantryOnly.tickFraction);
  expect(cappedTanks.tickFraction).toBeCloseTo(atCap.tickFraction);
  expect(
    legacy.attackLogic({
      ...attack,
      attacker: { ...attack.attacker, tanks: 100 },
    }),
  ).toEqual(legacy.attackLogic(attack));
});
