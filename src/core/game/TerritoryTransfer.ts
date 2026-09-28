import type { Player, TerraNullius } from "./Game";
import type { TileRef } from "./GameMap";

export const MAX_PEACE_TERRITORY_PERCENT = 50;

interface TerritoryGraph {
  neighbors4(tile: TileRef, out: TileRef[]): number;
  owner(tile: TileRef): Player | TerraNullius;
}

/**
 * Selects a deterministic, connected slice of the ceding player's land that
 * touches the recipient. The ceding player's spawn tile is preserved; when it
 * has no recorded spawn, the lowest owned tile is kept so the player survives.
 * Returns null when the requested share cannot be transferred as one region.
 */
export function planPeaceTerritoryTransfer(
  game: TerritoryGraph,
  ceding: Pick<Player, "spawnTile" | "tiles">,
  recipient: Pick<Player, "smallID">,
  percent: number,
): TileRef[] | null {
  if (
    !Number.isInteger(percent) ||
    percent < 1 ||
    percent > MAX_PEACE_TERRITORY_PERCENT
  ) {
    return null;
  }

  const allTiles = [...ceding.tiles()].sort((a, b) => a - b);
  const spawnTile = ceding.spawnTile();
  const protectedTile =
    spawnTile !== undefined && allTiles.includes(spawnTile)
      ? spawnTile
      : allTiles[0];
  const eligibleTiles = allTiles.filter((tile) => tile !== protectedTile);
  const transferCount = Math.max(
    1,
    Math.floor((allTiles.length * percent) / 100),
  );
  if (transferCount > eligibleTiles.length) return null;

  const ownedTiles = new Set(eligibleTiles);
  const visited = new Set<TileRef>();
  const neighbors: TileRef[] = [];
  let bestRegion: TileRef[] | null = null;
  let bestBorderTile: TileRef | null = null;

  for (const start of eligibleTiles) {
    if (visited.has(start)) continue;

    const region: TileRef[] = [];
    const queue = [start];
    visited.add(start);
    let borderTile: TileRef | null = null;

    for (let index = 0; index < queue.length; index++) {
      const tile = queue[index];
      region.push(tile);
      const neighborCount = game.neighbors4(tile, neighbors);
      for (
        let neighborIndex = 0;
        neighborIndex < neighborCount;
        neighborIndex++
      ) {
        const neighbor = neighbors[neighborIndex];
        if (ownedTiles.has(neighbor)) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
          continue;
        }

        const owner = game.owner(neighbor);
        if (
          owner.isPlayer() &&
          owner.smallID() === recipient.smallID() &&
          (borderTile === null || tile < borderTile)
        ) {
          borderTile = tile;
        }
      }
    }

    if (
      borderTile !== null &&
      region.length >= transferCount &&
      (bestRegion === null ||
        region.length > bestRegion.length ||
        (region.length === bestRegion.length && region[0] < bestRegion[0]))
    ) {
      bestRegion = region;
      bestBorderTile = borderTile;
    }
  }

  if (bestRegion === null || bestBorderTile === null) return null;

  const regionTiles = new Set(bestRegion);
  const transfer: TileRef[] = [];
  const queue = [bestBorderTile];
  const selected = new Set<TileRef>(queue);
  for (
    let index = 0;
    index < queue.length && transfer.length < transferCount;
    index++
  ) {
    const tile = queue[index];
    transfer.push(tile);
    const neighborCount = game.neighbors4(tile, neighbors);
    const adjacent = neighbors
      .slice(0, neighborCount)
      .filter(
        (neighbor) => regionTiles.has(neighbor) && !selected.has(neighbor),
      )
      .sort((a, b) => a - b);
    for (const neighbor of adjacent) {
      selected.add(neighbor);
      queue.push(neighbor);
    }
  }

  return transfer.length === transferCount ? transfer : null;
}
