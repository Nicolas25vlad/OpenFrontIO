import { expect, test } from "vitest";
import { NAVAL_SUPREMACY } from "../../../src/core/configuration/StrategyConfig";
import { Game, Unit, UnitType } from "../../../src/core/game/Game";
import { TileRef } from "../../../src/core/game/GameMap";
import { isNavalSectorBlockaded } from "../../../src/core/game/NavalSupremacy";

const MAP_WIDTH = 128;

function tile(x: number, y: number): TileRef {
  return (y * MAP_WIDTH + x) as TileRef;
}

function makeUnit(
  position: TileRef,
  owner: { canAttackPlayer: (other: unknown) => boolean },
): Unit {
  return {
    tile: () => position,
    owner: () => owner,
    isActive: () => true,
    isUnderConstruction: () => false,
    warshipState: () => ({ state: "patrolling" }),
    health: () => 100,
    maxHealth: () => 100,
    level: () => 1,
  } as unknown as Unit;
}

function makeGame(port: Unit, warships: Unit[]) {
  const x = (ref: TileRef) => ref % MAP_WIDTH;
  const y = (ref: TileRef) => Math.floor(ref / MAP_WIDTH);
  return {
    width: () => MAP_WIDTH,
    x,
    y,
    config: () => ({
      navalSectorSize: () => NAVAL_SUPREMACY.sectorSize,
      navalBlockadeAdvantage: () => NAVAL_SUPREMACY.blockadeAdvantage,
    }),
    getWaterComponent: () => 1,
    nearbyUnits: (
      center: TileRef,
      radius: number,
      type: UnitType,
    ): Array<{ unit: Unit; distSquared: number }> => {
      expect(type).toBe(UnitType.Warship);
      const radiusSquared = radius * radius;
      return warships.flatMap((unit) => {
        const dx = x(unit.tile()) - x(center);
        const dy = y(unit.tile()) - y(center);
        const distSquared = dx * dx + dy * dy;
        return distSquared <= radiusSquared ? [{ unit, distSquared }] : [];
      });
    },
    _port: port,
  } as unknown as Game;
}

test("counts ships at the far corner of their port's sector", () => {
  const hostileOwner = { canAttackPlayer: () => true };
  const portOwner = {
    canAttackPlayer: (other: unknown) => other === hostileOwner,
  };
  const port = makeUnit(tile(1, 1), portOwner);
  const ships = [
    makeUnit(tile(63, 63), hostileOwner),
    makeUnit(tile(63, 62), hostileOwner),
  ];

  expect(isNavalSectorBlockaded(makeGame(port, ships), port)).toBe(true);
});

test("ships in an adjacent sector do not affect the port's blockade", () => {
  const hostileOwner = { canAttackPlayer: () => true };
  const portOwner = {
    canAttackPlayer: (other: unknown) => other === hostileOwner,
  };
  const port = makeUnit(tile(1, 1), portOwner);
  const ships = [
    makeUnit(tile(64, 63), hostileOwner),
    makeUnit(tile(64, 62), hostileOwner),
  ];

  expect(isNavalSectorBlockaded(makeGame(port, ships), port)).toBe(false);
});
