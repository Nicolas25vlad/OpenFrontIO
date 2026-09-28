import { describe, expect, it } from "vitest";
import {
  deriveTroopGarrisons,
  MAX_GARRISON_SQUADS,
  TROOPS_PER_GARRISON_SQUAD,
} from "../../../../src/client/render/gl/passes/TroopGarrisons";
import type { PlayerState } from "../../../../src/client/render/types";

function player(troops: number): PlayerState {
  return { troops } as PlayerState;
}

describe("troop garrison layout", () => {
  it("places bounded squads only on owned frontier tiles", () => {
    const width = 5;
    const height = 5;
    const tiles = new Uint16Array(width * height);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) tiles[y * width + x] = 7;
    }

    const layout = deriveTroopGarrisons(
      tiles,
      width,
      height,
      new Map([[7, player(TROOPS_PER_GARRISON_SQUAD * 4)]]),
    );

    expect(layout.count).toBe(4);
    for (let i = 0; i < layout.count; i++) {
      const x = layout.instances[i * 3];
      const y = layout.instances[i * 3 + 1];
      const owner = layout.instances[i * 3 + 2];
      expect(owner).toBe(7);
      expect(tiles[y * width + x]).toBe(7);
      expect(x === 2 && y === 2).toBe(false);
    }
  });

  it("treats the map edge as a frontier for territories reaching the bounds", () => {
    const width = 3;
    const height = 3;
    const tiles = new Uint16Array(width * height).fill(7);
    const layout = deriveTroopGarrisons(
      tiles,
      width,
      height,
      new Map([[7, player(TROOPS_PER_GARRISON_SQUAD)]]),
    );

    expect(layout.count).toBe(1);
    const x = layout.instances[0];
    const y = layout.instances[1];
    expect(x === 0 || x === width - 1 || y === 0 || y === height - 1).toBe(
      true,
    );
  });

  it("keeps identical layouts deterministic and caps total sprite instances", () => {
    const width = 200;
    const height = 20;
    const tiles = new Uint16Array(width * height);
    const players = new Map<number, PlayerState>();
    for (let owner = 1; owner <= 100; owner++) {
      players.set(owner, player(1_000_000_000));
      for (let y = 0; y < height; y++) {
        for (let x = (owner - 1) * 2; x < owner * 2; x++) {
          tiles[y * width + x] = owner;
        }
      }
    }

    const first = deriveTroopGarrisons(tiles, width, height, players);
    const second = deriveTroopGarrisons(tiles, width, height, players);

    expect(first.count).toBeLessThanOrEqual(MAX_GARRISON_SQUADS);
    expect(first.count).toBeGreaterThan(MAX_GARRISON_SQUADS - 50);
    expect(second).toEqual(first);
  });

  it("shows no squads below the visual troop threshold", () => {
    const tiles = new Uint16Array(9);
    tiles[4] = 1;

    expect(
      deriveTroopGarrisons(tiles, 3, 3, new Map([[1, player(100)]])),
    ).toEqual({ instances: new Float32Array(0), count: 0 });
  });
});
