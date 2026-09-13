import type { GameMap } from "../core/game/GameMap";
import {
  NaturalResource,
  RESOURCE_NODE_CELL_SIZE,
  resourceNodesForMap,
} from "../core/game/Resources";

export const RESOURCE_MAP_LAYER_ID = "openfront-resource-map";

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

  for (const node of nodes) {
    const color = RESOURCE_COLORS[node.resource];
    const radius = RESOURCE_NODE_CELL_SIZE * 0.7 + node.richness * 10;
    const gradient = context.createRadialGradient(
      node.x,
      node.y,
      0,
      node.x,
      node.y,
      radius,
    );
    gradient.addColorStop(0, colorWithAlpha(color, 0.68));
    gradient.addColorStop(0.4, colorWithAlpha(color, 0.43));
    gradient.addColorStop(0.75, colorWithAlpha(color, 0.12));
    gradient.addColorStop(1, colorWithAlpha(color, 0));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(node.x, node.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  for (const node of nodes) {
    drawResourcePixelIcon(context, node.resource, node.x, node.y);
  }

  return createImageBitmap(canvas);
}
