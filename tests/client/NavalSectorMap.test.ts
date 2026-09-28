import { afterEach, expect, test, vi } from "vitest";
import {
  createNavalControlMapImage,
  createNavalSectorMapImage,
} from "../../src/client/ResourceMap";
import { GameMap } from "../../src/core/game/GameMap";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("renders one labeled water-sector cell per logical sector", async () => {
  const fillRect = vi.fn();
  const strokeRect = vi.fn();
  const fillText = vi.fn();
  const context = {
    fillRect,
    strokeRect,
    fillText,
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  vi.spyOn(document, "createElement").mockReturnValue(canvas);
  const bitmap = {} as ImageBitmap;
  const createBitmap = vi.fn(async () => bitmap);
  vi.stubGlobal("createImageBitmap", createBitmap);
  const map = {
    width: () => 130,
    height: () => 70,
  } as GameMap;

  await expect(createNavalSectorMapImage(map, 64)).resolves.toBe(bitmap);

  expect(canvas.width).toBe(130);
  expect(canvas.height).toBe(70);
  expect(fillRect).toHaveBeenCalledTimes(6);
  expect(strokeRect).toHaveBeenCalledTimes(6);
  expect(fillText.mock.calls.map(([label]) => label)).toEqual([
    "0,0",
    "1,0",
    "2,0",
    "0,1",
    "1,1",
    "2,1",
  ]);
  expect(createBitmap).toHaveBeenCalledWith(canvas);
});

test("rejects invalid sector sizes", async () => {
  await expect(
    createNavalSectorMapImage(
      { width: () => 10, height: () => 10 } as GameMap,
      0,
    ),
  ).rejects.toThrow("naval sector size must be a positive integer");
});

test("renders friendly, balanced, and hostile strength with clipped edge sectors", async () => {
  let currentFillStyle = "";
  const fillStyleByRect: string[] = [];
  const fillRect = vi.fn(() => fillStyleByRect.push(currentFillStyle));
  const context = {
    fillRect,
    set fillStyle(value: string) {
      currentFillStyle = value;
    },
    get fillStyle() {
      return currentFillStyle;
    },
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  vi.spyOn(document, "createElement").mockReturnValue(canvas);
  const bitmap = {} as ImageBitmap;
  const createBitmap = vi.fn(async () => bitmap);
  vi.stubGlobal("createImageBitmap", createBitmap);
  const map = {
    width: () => 130,
    height: () => 70,
  } as GameMap;

  await expect(
    createNavalControlMapImage(map, 64, [
      { x: 0, y: 0, friendly: 2, hostile: 0 },
      { x: 1, y: 0, friendly: 1.1, hostile: 1 },
      { x: 2, y: 0, friendly: 0, hostile: 4 },
      { x: 3, y: 0, friendly: 1, hostile: 0 },
      { x: 0, y: 1, friendly: 0, hostile: 0 },
    ]),
  ).resolves.toBe(bitmap);

  expect(canvas.width).toBe(130);
  expect(canvas.height).toBe(70);
  expect(fillRect.mock.calls).toEqual([
    [0, 0, 64, 64],
    [64, 0, 64, 64],
    [128, 0, 2, 64],
  ]);
  expect(fillStyleByRect).toEqual([
    "rgba(16, 185, 129, 0.24)",
    "rgba(234, 179, 8, 0.246)",
    "rgba(239, 68, 68, 0.36)",
  ]);
  expect(createBitmap).toHaveBeenCalledWith(canvas);
});
