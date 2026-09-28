import { STRATEGIC_COMBAT } from "../../core/configuration/StrategyConfig";

/** Converts the attack's troop count and selected tank ratio to a request. */
export function requestedTanksForAttack(
  troops: number,
  commitmentRatio: number | undefined,
): number | undefined {
  if (commitmentRatio === undefined) return undefined;
  const ratio = Math.max(0, Math.min(1, commitmentRatio));
  return Math.floor((troops / STRATEGIC_COMBAT.infantryPerTank) * ratio);
}
