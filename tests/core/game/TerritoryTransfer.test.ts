import { describe, expect, test } from "vitest";
import type { Player, TerraNullius } from "../../../src/core/game/Game";
import type { TileRef } from "../../../src/core/game/GameMap";
import {
  MAX_PEACE_TERRITORY_PERCENT,
  planPeaceTerritoryTransfer,
} from "../../../src/core/game/TerritoryTransfer";

function graph(
  width: number,
  height: number,
  owners: ReadonlyMap<number, number>,
) {
  return {
    neighbors4(tile: TileRef, out: TileRef[]) {
      const x = tile % width;
      const y = Math.floor(tile / width);
      const candidates = [
        ...(x > 0 ? [tile - 1] : []),
        ...(x + 1 < width ? [tile + 1] : []),
        ...(y > 0 ? [tile - width] : []),
        ...(y + 1 < height ? [tile + width] : []),
      ];
      out.splice(0, out.length, ...candidates);
      return candidates.length;
    },
    owner(tile: TileRef) {
      const id = owners.get(tile) ?? 0;
      if (id === 0) {
        return { isPlayer: () => false, smallID: () => 0 } as TerraNullius;
      }
      return {
        isPlayer: () => true,
        smallID: () => id,
      } as Player;
    },
  };
}

function player(id: number, tileIDs: number[], spawnTile: number | undefined) {
  return {
    smallID: () => id,
    spawnTile: () => spawnTile as TileRef,
    tiles: () => new Set(tileIDs as TileRef[]),
  } as unknown as Pick<Player, "smallID" | "spawnTile" | "tiles">;
}

describe("peace territory transfer planning", () => {
  test("selects a connected cession touching the recipient and keeps the spawn tile", () => {
    const owners = new Map<number, number>([
      [5, 2],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 1],
      [11, 1],
      [12, 1],
      [13, 1],
      [14, 1],
    ]);
    const transfer = planPeaceTerritoryTransfer(
      graph(5, 3, owners),
      player(1, [14, 13, 12, 11, 9, 8, 7, 6], 14),
      player(2, [5], 5),
      40,
    );

    expect(transfer).toEqual([6, 7, 11]);
    expect(transfer).not.toContain(14);
  });

  test("selects the same tiles regardless of tile insertion order", () => {
    const owners = new Map<number, number>([
      [5, 2],
      [6, 1],
      [7, 1],
      [8, 1],
      [9, 1],
      [11, 1],
      [12, 1],
      [13, 1],
      [14, 1],
    ]);
    const first = planPeaceTerritoryTransfer(
      graph(5, 3, owners),
      player(1, [6, 7, 8, 9, 11, 12, 13, 14], 14),
      player(2, [5], 5),
      40,
    );
    const second = planPeaceTerritoryTransfer(
      graph(5, 3, owners),
      player(1, [14, 13, 12, 11, 9, 8, 7, 6], 14),
      player(2, [5], 5),
      40,
    );

    expect(second).toEqual(first);
  });

  test("rejects shares that cannot be transferred as one connected border region", () => {
    const owners = new Map<number, number>([
      [5, 2],
      [6, 1],
      [7, 1],
      [9, 1],
      [14, 1],
      [17, 1],
      [18, 1],
      [19, 1],
    ]);

    expect(
      planPeaceTerritoryTransfer(
        graph(5, 4, owners),
        player(1, [6, 7, 9, 14, 17, 18, 19], 19),
        player(2, [5], 5),
        50,
      ),
    ).toBeNull();
  });

  test("rejects invalid percentages and preserves the ceding player's spawn", () => {
    const owners = new Map<number, number>([
      [5, 2],
      [6, 1],
      [7, 1],
      [8, 1],
    ]);
    const ceding = player(1, [6, 7, 8], 6);

    expect(
      planPeaceTerritoryTransfer(
        graph(5, 3, owners),
        ceding,
        player(2, [5], 5),
        0,
      ),
    ).toBeNull();
    expect(
      planPeaceTerritoryTransfer(
        graph(5, 3, owners),
        ceding,
        player(2, [5], 5),
        MAX_PEACE_TERRITORY_PERCENT + 1,
      ),
    ).toBeNull();
  });

  test("never transfers the ceding player's last tile when no spawn is recorded", () => {
    const owners = new Map<number, number>([
      [5, 2],
      [6, 1],
    ]);

    expect(
      planPeaceTerritoryTransfer(
        graph(5, 3, owners),
        player(1, [6], undefined),
        player(2, [5], 5),
        MAX_PEACE_TERRITORY_PERCENT,
      ),
    ).toBeNull();
  });
});
