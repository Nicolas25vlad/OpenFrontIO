import { describe, expect, test, vi } from "vitest";
import {
  drawResourcePixelIcon,
  RESOURCE_COLORS,
  RESOURCE_ICONS,
  RESOURCE_PIXEL_ART,
} from "../../src/client/ResourceMap";
import { NaturalResource } from "../../src/core/game/Resources";

describe("resource visualization icons", () => {
  test("has a recognizable colored icon for every resource", () => {
    for (const resource of Object.values(NaturalResource)) {
      expect(RESOURCE_ICONS[resource]).toBeTruthy();
      expect(RESOURCE_COLORS[resource]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  test("paints every resource as a crisp pixel-art sprite", () => {
    const fillRect = vi.fn();
    const context = { fillRect } as unknown as CanvasRenderingContext2D;

    for (const resource of Object.values(NaturalResource)) {
      expect(RESOURCE_PIXEL_ART[resource]).toHaveLength(9);
      expect(
        RESOURCE_PIXEL_ART[resource].every((row) => row.length === 9),
      ).toBe(true);
      drawResourcePixelIcon(context, resource, 100, 100);
    }

    expect(fillRect).toHaveBeenCalled();
  });

  test("uses a recognizable gold-ore silhouette", () => {
    expect(RESOURCE_PIXEL_ART[NaturalResource.Gold]).toEqual([
      "  ooooo  ",
      " obbbbbo ",
      "obbcbbcbo",
      "obcccbbbo",
      "obbccccbo",
      "obcbbbcbo",
      "obccbbbbo",
      " obbccco ",
      "  ooooo  ",
    ]);
  });

  test("uses rocky ore blocks for minerals and a dark droplet for oil", () => {
    const minerals = [
      NaturalResource.Iron,
      NaturalResource.Coal,
      NaturalResource.Gold,
      NaturalResource.Copper,
      NaturalResource.Uranium,
      NaturalResource.Potash,
    ];

    for (const resource of minerals) {
      const sprite = RESOURCE_PIXEL_ART[resource].join("");
      expect(sprite).toContain("b");
      expect(sprite).toContain("c");
    }

    expect(RESOURCE_PIXEL_ART[NaturalResource.Oil].join("")).toContain("b");
  });

  test("uses a centered droplet silhouette for oil", () => {
    expect(RESOURCE_PIXEL_ART[NaturalResource.Oil]).toEqual([
      "    o    ",
      "   obo   ",
      "  obbbo  ",
      "  ohbbo  ",
      " obbbbbo ",
      " obbbbbo ",
      " obbbbbo ",
      "  obbbo  ",
      "   obo   ",
    ]);
  });
});
