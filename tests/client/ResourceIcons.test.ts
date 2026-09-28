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

  test("renders cached noise concentrations as a repeatable geological field", async () => {
    const rasterData: Uint8ClampedArray[] = [];
    const contexts: CanvasRenderingContext2D[] = [];
    const canvases: HTMLCanvasElement[] = [];
    const createCanvas = () => {
      const context = {
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
        putImageData: (image: ImageData) => {
          rasterData.push(new Uint8ClampedArray(image.data));
        },
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        imageSmoothingEnabled: false,
      } as unknown as CanvasRenderingContext2D;
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
      } as unknown as HTMLCanvasElement;
      contexts.push(context);
      canvases.push(canvas);
      return canvas;
    };
    vi.stubGlobal("document", {
      createElement: createCanvas,
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
      const firstRaster = new Uint8ClampedArray(rasterData[0]);
      await createResourceMapImage(map as never, "visual-test-seed");

      expect(
        rasterData[0].some((alpha, index) => index % 4 === 3 && alpha > 0),
      ).toBe(true);
      expect(
        new Set(
          rasterData[0].filter((alpha, index) => index % 4 === 3 && alpha > 0),
        ).size,
      ).toBeGreaterThan(1);
      expect(rasterData[1]).toEqual(firstRaster);
      expect(canvases[1].width).toBe(128);
      expect(canvases[1].height).toBe(128);
      expect(contexts[0].drawImage).toHaveBeenCalledOnce();
      expect(contexts[0].drawImage).toHaveBeenCalledWith(
        canvases[1],
        0,
        0,
        width,
        width,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
