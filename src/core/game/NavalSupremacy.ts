import { Game, Unit, UnitType } from "./Game";
import { TileRef } from "./GameMap";

/**
 * A coastal port is blockaded when hostile warship strength exceeds local
 * friendly strength by the configured threshold in its logical sea sector.
 * Sector membership is derived from tile coordinates and connected water, so
 * this adds no persistent map-sized state.
 */
export function isNavalSectorBlockaded(game: Game, port: Unit): boolean {
  const sectorSize = game.config().navalSectorSize();
  const sectorsPerRow = Math.ceil(game.width() / sectorSize);
  const sectorID = (tile: TileRef) =>
    Math.floor(game.y(tile) / sectorSize) * sectorsPerRow +
    Math.floor(game.x(tile) / sectorSize);
  const portSector = sectorID(port.tile());
  const portWaterComponent = game.getWaterComponent(port.tile());
  if (portWaterComponent === null) return false;

  let hostileStrength = 0;
  let friendlyStrength = 0;
  for (const { unit } of game.nearbyUnits(
    port.tile(),
    sectorSize,
    UnitType.Warship,
  )) {
    if (
      !unit.isActive() ||
      unit.isUnderConstruction() ||
      unit.warshipState().state === "docked" ||
      sectorID(unit.tile()) !== portSector
    ) {
      continue;
    }
    const component = game.getWaterComponent(unit.tile());
    if (component === null || component !== portWaterComponent) continue;
    const strength =
      (unit.health() / Math.max(1, unit.maxHealth())) * unit.level();
    if (port.owner().canAttackPlayer(unit.owner())) {
      hostileStrength += strength;
    } else {
      friendlyStrength += strength;
    }
  }

  return (
    hostileStrength - friendlyStrength >= game.config().navalBlockadeAdvantage()
  );
}
