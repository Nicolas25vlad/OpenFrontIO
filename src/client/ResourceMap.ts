import type { GameMap } from "../core/game/GameMap";
import {
  NaturalResource,
  resourceNodeCellSizeForMap,
  resourceNodesForMap,
} from "../core/game/Resources";

export const RESOURCE_MAP_LAYER_ID = "openfront-resource-map";
export const NAVAL_SECTOR_MAP_LAYER_ID = "openfront-naval-sectors";
export const NAVAL_CONTROL_MAP_LAYER_ID = "openfront-naval-control";

export const RESOURCE_COLORS: Record<NaturalResource, string> = {
  [NaturalResource.Oil]: "#ef4444",
  [NaturalResource.Iron]: "#cbd5e1",
  [NaturalResource.Coal]: "#64748b",
  [NaturalResource.Gold]: "#facc15",
  [NaturalResource.Copper]: "#ea580c",
  [NaturalResource.Uranium]: "#22c55e",
  [NaturalResource.Potash]: "#06b6d4",
};

export const RESOURCE_ICONS: Record<NaturalResource, string> = {
  [NaturalResource.Oil]: "◆",
  [NaturalResource.Iron]: "⬢",
  [NaturalResource.Coal]: "■",
  [NaturalResource.Gold]: "✦",
  [NaturalResource.Copper]: "●",
  [NaturalResource.Uranium]: "☢",
  [NaturalResource.Potash]: "✚",
};

export const RESOURCE_PIXEL_ART: Readonly<
  Record<NaturalResource, readonly string[]>
> = {
  [NaturalResource.Oil]: [
    "    o    ",
    "   obo   ",
    "  obbbo  ",
    "  ohbbo  ",
    " obbbbbo ",
    " obbbbbo ",
    " obbbbbo ",
    "  obbbo  ",
    "   obo   ",
  ],
  [NaturalResource.Iron]: [
    "  ooooo  ",
    " obbbbbo ",
    "obbbccbbo",
    "obcbccbbo",
    "obbccccbo",
    "obbbcbbbo",
    "obccbbbbo",
    " obbbcco ",
    "  ooooo  ",
  ],
  [NaturalResource.Coal]: [
    "  ooooo  ",
    " obbbbbo ",
    "obbbccbbo",
    "obbccccbo",
    "obcbcbbbo",
    "obccbbbbo",
    "obbccccbo",
    " obbbcco ",
    "  ooooo  ",
  ],
  [NaturalResource.Gold]: [
    "  ooooo  ",
    " obbbbbo ",
    "obbcbbcbo",
    "obcccbbbo",
    "obbccccbo",
    "obcbbbcbo",
    "obccbbbbo",
    " obbccco ",
    "  ooooo  ",
  ],
  [NaturalResource.Copper]: [
    "  ooooo  ",
    " obbbbbo ",
    "obcbbbcbo",
    "obbccccbo",
    "obbcbbbbo",
    "obcccbbbo",
    "obbccccbo",
    " obbbcco ",
    "  ooooo  ",
  ],
  [NaturalResource.Uranium]: [
    "  ooooo  ",
    " obbbbbo ",
    "obcbbccbo",
    "obcccbbbo",
    "obbccccbo",
    "obcbbccbo",
    "obcccbbbo",
    " obbbcco ",
    "  ooooo  ",
  ],
  [NaturalResource.Potash]: [
    "  ooooo  ",
    " obbbbbo ",
    "obbbccbbo",
    "obccbbbbo",
    "obbbcccbo",
    "obcbcbbbo",
    "obccbbbbo",
    " obbbcco ",
    "  ooooo  ",
  ],
};

const RESOURCE_PIXEL_SIZE = 2;
const iconUrls = new Map<NaturalResource, string>();

/** Reuse the map's approved pixel art in the stock panel. */
export function resourceIconUrl(resource: NaturalResource): string {
  let url = iconUrls.get(resource);
  if (url) return url;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 20;
  const context = canvas.getContext("2d");
  if (!context) return "";
  drawResourcePixelIcon(context, resource, 9, 9);
  url = canvas.toDataURL();
  iconUrls.set(resource, url);
  return url;
}
const RESOURCE_ICON_OUTLINE = "#08111f";
const RESOURCE_PIXEL_BASE: Record<NaturalResource, string> = {
  [NaturalResource.Oil]: "#111827",
  [NaturalResource.Iron]: "#6b7280",
  [NaturalResource.Coal]: "#111827",
  [NaturalResource.Gold]: "#64748b",
  [NaturalResource.Copper]: "#57534e",
  [NaturalResource.Uranium]: "#374151",
  [NaturalResource.Potash]: "#a8a29e",
};
const RESOURCE_PIXEL_ORE: Record<NaturalResource, string> = {
  [NaturalResource.Oil]: "#111827",
  [NaturalResource.Iron]: "#cbd5e1",
  [NaturalResource.Coal]: "#6b7280",
  [NaturalResource.Gold]: "#facc15",
  [NaturalResource.Copper]: "#f97316",
  [NaturalResource.Uranium]: "#84cc16",
  [NaturalResource.Potash]: "#e879f9",
};
const RESOURCE_PIXEL_HIGHLIGHT: Record<NaturalResource, string> = {
  [NaturalResource.Oil]: "#64748b",
  [NaturalResource.Iron]: "#f8fafc",
  [NaturalResource.Coal]: "#9ca3af",
  [NaturalResource.Gold]: "#fef08a",
  [NaturalResource.Copper]: "#fdba74",
  [NaturalResource.Uranium]: "#d9f99d",
  [NaturalResource.Potash]: "#f5d0fe",
};

export function drawResourcePixelIcon(
  context: CanvasRenderingContext2D,
  resource: NaturalResource,
  x: number,
  y: number,
): void {
  const sprite = RESOURCE_PIXEL_ART[resource];
  const size = sprite.length * RESOURCE_PIXEL_SIZE;
  const originX = Math.round(x - size / 2);
  const originY = Math.round(y - size / 2);

  context.imageSmoothingEnabled = false;
  for (let row = 0; row < sprite.length; row++) {
    for (let column = 0; column < sprite[row].length; column++) {
      if (sprite[row][column] !== " ") {
        context.fillStyle = RESOURCE_ICON_OUTLINE;
        context.fillRect(
          originX + column * RESOURCE_PIXEL_SIZE + RESOURCE_PIXEL_SIZE,
          originY + row * RESOURCE_PIXEL_SIZE + RESOURCE_PIXEL_SIZE,
          RESOURCE_PIXEL_SIZE,
          RESOURCE_PIXEL_SIZE,
        );
      }
    }
  }

  for (let row = 0; row < sprite.length; row++) {
    for (let column = 0; column < sprite[row].length; column++) {
      const pixel = sprite[row][column];
      if (pixel === " ") continue;
      context.fillStyle =
        pixel === "o"
          ? RESOURCE_ICON_OUTLINE
          : pixel === "b"
            ? RESOURCE_PIXEL_BASE[resource]
            : pixel === "h"
              ? RESOURCE_PIXEL_HIGHLIGHT[resource]
              : RESOURCE_PIXEL_ORE[resource];
      context.fillRect(
        originX + column * RESOURCE_PIXEL_SIZE,
        originY + row * RESOURCE_PIXEL_SIZE,
        RESOURCE_PIXEL_SIZE,
        RESOURCE_PIXEL_SIZE,
      );
    }
  }
}

function colorWithAlpha(color: string, alpha: number): string {
  return `${color}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function visualNoise(
  node: { x: number; y: number; resource: NaturalResource },
  sample: number,
): number {
  let value =
    (Math.imul(node.x + 1, 0x45d9f3b) ^
      Math.imul(node.y + 1, 0x119de1f3) ^
      Math.imul(
        Object.values(NaturalResource).indexOf(node.resource) + 1,
        0x27d4eb2d,
      ) ^
      Math.imul(sample + 1, 0x165667b1)) >>>
    0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return (value ^ (value >>> 16)) / 0xffffffff;
}

/** Draws a deterministic, softly edged deposit field with an irregular contour. */
function drawResourceField(
  context: CanvasRenderingContext2D,
  node: { x: number; y: number; resource: NaturalResource; richness: number },
  cellSize: number,
): void {
  const radius = cellSize * (1.05 + node.richness * 0.15);
  const points = 24;
  const contour: Array<{ x: number; y: number }> = [];
  for (let index = 0; index < points; index++) {
    const angle = (index / points) * Math.PI * 2;
    // Average adjacent fixed samples to form broad lobes instead of noisy spikes.
    const variation =
      (visualNoise(node, index) + visualNoise(node, (index + 1) % points)) / 2;
    const localRadius = radius * (0.78 + variation * 0.4);
    contour.push({
      x: node.x + Math.cos(angle) * localRadius,
      y: node.y + Math.sin(angle) * localRadius,
    });
  }

  context.beginPath();
  const first = contour[0];
  const last = contour[contour.length - 1];
  context.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
  for (let index = 0; index < points; index++) {
    const current = contour[index];
    const next = contour[(index + 1) % points];
    context.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2,
    );
  }
  context.closePath();
  context.save();
  context.clip();

  const gradient = context.createRadialGradient(
    node.x,
    node.y,
    0,
    node.x,
    node.y,
    radius,
  );
  const color = RESOURCE_COLORS[node.resource];
  gradient.addColorStop(0, colorWithAlpha(color, 0.4));
  gradient.addColorStop(0.4, colorWithAlpha(color, 0.28));
  gradient.addColorStop(0.78, colorWithAlpha(color, 0.08));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2);
  context.restore();
}

/** Build one client-only texture from the deterministic geological catalog. */
export async function createResourceMapImage(
  map: GameMap,
  matchSeed: string,
): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = map.width();
  canvas.height = map.height();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("resource map canvas is unavailable");
  context.globalCompositeOperation = "source-over";
  const nodes = resourceNodesForMap(map, matchSeed);
  const cellSize = resourceNodeCellSizeForMap(map);

  for (const node of nodes) {
    // Overlapping warped contours read as geological belts instead of circles.
    drawResourceField(context, node, cellSize);
  }

  for (const node of nodes) {
    drawResourcePixelIcon(context, node.resource, node.x, node.y);
  }

  return createImageBitmap(canvas);
}

/** Build a static grid texture; MapLayerPass clips it to water tiles. */
export async function createNavalSectorMapImage(
  map: GameMap,
  sectorSize: number,
): Promise<ImageBitmap> {
  if (!Number.isInteger(sectorSize) || sectorSize <= 0) {
    throw new Error("naval sector size must be a positive integer");
  }
  const canvas = document.createElement("canvas");
  canvas.width = map.width();
  canvas.height = map.height();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("naval sector map canvas is unavailable");

  const fontSize = Math.max(8, Math.min(16, sectorSize * 0.18));
  context.font = `600 ${fontSize}px monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let y = 0; y < map.height(); y += sectorSize) {
    for (let x = 0; x < map.width(); x += sectorSize) {
      const width = Math.min(sectorSize, map.width() - x);
      const height = Math.min(sectorSize, map.height() - y);
      context.fillStyle = "rgba(14, 116, 144, 0.10)";
      context.fillRect(x, y, width, height);
      context.strokeStyle = "rgba(56, 189, 248, 0.72)";
      context.lineWidth = 1.5;
      context.strokeRect(x + 0.75, y + 0.75, width - 1.5, height - 1.5);
      context.fillStyle = "rgba(224, 242, 254, 0.9)";
      context.fillText(
        `${x / sectorSize},${y / sectorSize}`,
        x + width / 2,
        y + height / 2,
        Math.max(0, width - 8),
      );
    }
  }

  return createImageBitmap(canvas);
}

export interface NavalSectorStrength {
  x: number;
  y: number;
  friendly: number;
  hostile: number;
}

/** Build the estimated friendly/hostile warship-strength heatmap by sector. */
export async function createNavalControlMapImage(
  map: GameMap,
  sectorSize: number,
  sectors: readonly NavalSectorStrength[],
): Promise<ImageBitmap> {
  if (!Number.isInteger(sectorSize) || sectorSize <= 0) {
    throw new Error("naval sector size must be a positive integer");
  }
  const canvas = document.createElement("canvas");
  canvas.width = map.width();
  canvas.height = map.height();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("naval control map canvas is unavailable");

  for (const sector of sectors) {
    const x = sector.x * sectorSize;
    const y = sector.y * sectorSize;
    const width = Math.min(sectorSize, map.width() - x);
    const height = Math.min(sectorSize, map.height() - y);
    const totalStrength = sector.friendly + sector.hostile;
    if (width <= 0 || height <= 0 || totalStrength <= 0) continue;

    const difference = sector.friendly - sector.hostile;
    const color =
      Math.abs(difference) < 0.15
        ? "234, 179, 8"
        : difference > 0
          ? "16, 185, 129"
          : "239, 68, 68";
    const alpha = Math.min(0.42, 0.12 + totalStrength * 0.06);
    context.fillStyle = `rgba(${color}, ${alpha})`;
    context.fillRect(x, y, width, height);
  }

  return createImageBitmap(canvas);
}
