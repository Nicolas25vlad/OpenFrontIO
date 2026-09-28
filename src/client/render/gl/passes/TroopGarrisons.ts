import type { PlayerState } from "../../types";
import { OWNER_MASK } from "../utils/TileCodec";

/** One visual squad stands for this many troops; it never changes combat state. */
export const TROOPS_PER_GARRISON_SQUAD = 25_000;
/** Hard cap keeps instance uploads bounded even with many large nations. */
export const MAX_GARRISON_SQUADS = 2048;
const MAX_SQUADS_PER_PLAYER = 32;

export interface TroopGarrisonLayout {
  /** Packed triples: tileX, tileY, owner smallID. */
  readonly instances: Float32Array;
  readonly count: number;
}

interface PlayerSquadRequest {
  ownerID: number;
  requested: number;
  allocated: number;
  remainder: number;
  samples: number[];
  seen: number;
}

/**
 * Select a bounded, deterministic set of visual squads along owned frontiers.
 * The scan is over map state once per refresh, independent of player count;
 * callers throttle it and redraw the resulting small instance buffer each
 * frame. Nothing is added to the simulation or serialized in game updates.
 */
export function deriveTroopGarrisons(
  tileState: Uint16Array,
  mapWidth: number,
  mapHeight: number,
  players: ReadonlyMap<number, PlayerState>,
): TroopGarrisonLayout {
  const requests: PlayerSquadRequest[] = [];
  let totalRequested = 0;

  for (const [ownerID, player] of players) {
    const requested = Math.min(
      MAX_SQUADS_PER_PLAYER,
      Math.floor(Math.max(0, player.troops) / TROOPS_PER_GARRISON_SQUAD),
    );
    if (requested === 0) continue;
    requests.push({
      ownerID,
      requested,
      allocated: 0,
      remainder: 0,
      samples: [],
      seen: 0,
    });
    totalRequested += requested;
  }

  const requestByOwner = new Map(
    requests.map((request) => [request.ownerID, request]),
  );

  if (totalRequested > MAX_GARRISON_SQUADS) {
    let allocated = 0;
    for (const request of requests) {
      const exact = (request.requested * MAX_GARRISON_SQUADS) / totalRequested;
      request.allocated = Math.floor(exact);
      request.remainder = exact - request.allocated;
      allocated += request.allocated;
    }
    requests.sort((a, b) => b.remainder - a.remainder || a.ownerID - b.ownerID);
    for (let i = 0; allocated < MAX_GARRISON_SQUADS; i++) {
      const request = requests[i % requests.length];
      if (request.allocated >= request.requested) continue;
      request.allocated++;
      allocated++;
    }
  } else {
    for (const request of requests) request.allocated = request.requested;
  }

  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const ref = y * mapWidth + x;
      const ownerID = tileState[ref] & OWNER_MASK;
      if (ownerID === 0) continue;
      const request = requestByOwner.get(ownerID);
      if (request === undefined || request.allocated === 0) continue;

      const hasDifferentNeighbor =
        x === 0 ||
        x + 1 === mapWidth ||
        y === 0 ||
        y + 1 === mapHeight ||
        (x > 0 && (tileState[ref - 1] & OWNER_MASK) !== ownerID) ||
        (x + 1 < mapWidth && (tileState[ref + 1] & OWNER_MASK) !== ownerID) ||
        (y > 0 && (tileState[ref - mapWidth] & OWNER_MASK) !== ownerID) ||
        (y + 1 < mapHeight &&
          (tileState[ref + mapWidth] & OWNER_MASK) !== ownerID);
      if (!hasDifferentNeighbor) continue;

      request.seen++;
      if (request.samples.length < request.allocated) {
        request.samples.push(ref);
        continue;
      }
      const replacement = sampleIndex(ref, ownerID, request.seen);
      if (replacement < request.allocated) {
        request.samples[replacement] = ref;
      }
    }
  }

  const count = requests.reduce(
    (total, request) => total + request.samples.length,
    0,
  );
  const instances = new Float32Array(count * 3);
  let offset = 0;
  for (const request of requests) {
    for (const ref of request.samples) {
      instances[offset++] = ref % mapWidth;
      instances[offset++] = Math.floor(ref / mapWidth);
      instances[offset++] = request.ownerID;
    }
  }
  return { instances, count };
}

function sampleIndex(tileRef: number, ownerID: number, seen: number): number {
  let hash =
    Math.imul(tileRef + 1, 0x9e3779b1) ^ Math.imul(ownerID, 0x85ebca6b);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) % seen;
}
