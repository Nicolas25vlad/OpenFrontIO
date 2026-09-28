import { describe, expect, it } from "vitest";
import { requestedTanksForAttack } from "../../src/client/hud/TankCommitment";
import { STRATEGIC_COMBAT } from "../../src/core/configuration/StrategyConfig";

describe("requestedTanksForAttack", () => {
  it("keeps the legacy automatic allocation when no preference is set", () => {
    expect(requestedTanksForAttack(25_000, undefined)).toBeUndefined();
  });

  it("scales the troop-supported tank count by the selected percentage", () => {
    expect(requestedTanksForAttack(25_000, 0.5)).toBe(1);
    expect(requestedTanksForAttack(25_000, 0)).toBe(0);
  });

  it("clamps ratios outside the slider range", () => {
    expect(requestedTanksForAttack(25_000, -1)).toBe(0);
    expect(requestedTanksForAttack(25_000, 2)).toBe(
      Math.floor(25_000 / STRATEGIC_COMBAT.infantryPerTank),
    );
  });
});
