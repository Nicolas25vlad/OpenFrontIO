import { describe, expect, it } from "vitest";
import { Game } from "../../../src/core/game/Game";
import {
  nextWaterPathStagger,
  WaterPathFinder,
} from "../../../src/core/pathfinding/PathFinder";

describe("water pathfinder stagger allocation", () => {
  it("starts each game's stagger sequence at zero and wraps within that game", () => {
    const firstGame = {} as Game;
    const secondGame = {} as Game;

    expect(nextWaterPathStagger(firstGame)).toBe(0);
    expect(nextWaterPathStagger(firstGame)).toBe(1);
    expect(nextWaterPathStagger(secondGame)).toBe(0);

    for (let index = 2; index < WaterPathFinder.STAGGER_SPREAD; index++) {
      expect(nextWaterPathStagger(firstGame)).toBe(index);
    }
    expect(nextWaterPathStagger(firstGame)).toBe(0);
    expect(nextWaterPathStagger(secondGame)).toBe(1);
  });
});
