import { Config } from "../../src/core/configuration/Config";
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
});
