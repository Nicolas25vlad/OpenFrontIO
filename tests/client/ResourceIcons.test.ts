import { describe, expect, test, vi } from "vitest";
import {
  createResourceMapImage,
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

  test("renders cached deposits as repeatable irregular contours", async () => {
    const gradient = { addColorStop: vi.fn() };
    const quadraticCurveTo = vi.fn();
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo,
      closePath: vi.fn(),
      save: vi.fn(),
      clip: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      restore: vi.fn(),
      imageSmoothingEnabled: false,
    } as unknown as CanvasRenderingContext2D;
    vi.stubGlobal("document", {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => context,
      }),
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({}) as ImageBitmap),
    );

    try {
      const width = 1024;
      const map = {
        width: () => width,
        height: () => width,
        ref: (x: number, y: number) => y * width + x,
        x: (tile: number) => tile % width,
        y: (tile: number) => Math.floor(tile / width),
        isLand: () => true,
        isImpassable: () => false,
      };

      await createResourceMapImage(map as never, "visual-test-seed");
      const firstContour = quadraticCurveTo.mock.calls.map((call) => [...call]);
      quadraticCurveTo.mockClear();
      await createResourceMapImage(map as never, "visual-test-seed");

      expect(quadraticCurveTo).toHaveBeenCalled();
      expect(quadraticCurveTo.mock.calls).toEqual(firstContour);
      expect(context.clip).toHaveBeenCalled();
      expect(context.createRadialGradient).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
