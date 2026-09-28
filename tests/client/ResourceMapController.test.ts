import { afterEach, expect, test, vi } from "vitest";
import { ResourceMapController } from "../../src/client/controllers/ResourceMapController";
import {
  ToggleNavalSectorMapEvent,
  ToggleResourceMapEvent,
} from "../../src/client/InputHandler";
import {
  NAVAL_CONTROL_MAP_LAYER_ID,
  NAVAL_SECTOR_MAP_LAYER_ID,
  RESOURCE_MAP_LAYER_ID,
} from "../../src/client/ResourceMap";
import type { GameView } from "../../src/client/view/GameView";
import { EventBus } from "../../src/core/EventBus";
import { UnitType } from "../../src/core/game/Game";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("controls resource and both naval sector layers independently", () => {
  const eventBus = new EventBus();
  const setLayerVisible = vi.fn();
  const updateMapLayerImage = vi.fn();
  const controller = new ResourceMapController(
    eventBus,
    {
      setLayerVisible,
      updateMapLayerImage,
    } as never,
    { myPlayer: () => null } as never,
  );
  controller.init();

  expect(setLayerVisible).toHaveBeenNthCalledWith(
    1,
    RESOURCE_MAP_LAYER_ID,
    false,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    2,
    NAVAL_CONTROL_MAP_LAYER_ID,
    false,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    3,
    NAVAL_SECTOR_MAP_LAYER_ID,
    false,
  );

  eventBus.emit(new ToggleResourceMapEvent(true));
  eventBus.emit(new ToggleNavalSectorMapEvent(true));
  eventBus.emit(new ToggleResourceMapEvent(false));

  expect(setLayerVisible).toHaveBeenNthCalledWith(
    4,
    RESOURCE_MAP_LAYER_ID,
    true,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    5,
    NAVAL_CONTROL_MAP_LAYER_ID,
    true,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    6,
    NAVAL_SECTOR_MAP_LAYER_ID,
    true,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    7,
    RESOURCE_MAP_LAYER_ID,
    false,
  );
  expect(updateMapLayerImage).not.toHaveBeenCalled();
});

test("updates the visible heatmap from active warship strength by sector", async () => {
  const fillRect = vi.fn();
  const context = { fillRect } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  } as unknown as HTMLCanvasElement;
  vi.spyOn(document, "createElement").mockReturnValue(canvas);
  const image = { close: vi.fn() } as unknown as ImageBitmap;
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => image),
  );

  const player = {
    isMe: () => true,
    isFriendly: () => false,
  };
  let shipHealth = 100;
  const ship = {
    isActive: () => true,
    isUnderConstruction: () => false,
    warshipState: () => ({ state: "active" }),
    tile: () => 0,
    health: () => shipHealth,
    veterancy: () => 0,
    level: () => 2,
    owner: () => player,
  };
  const game = {
    myPlayer: () => player,
    units: (type: UnitType) => (type === UnitType.Warship ? [ship] : []),
    x: () => 10,
    y: () => 20,
    width: () => 100,
    height: () => 90,
    unitInfo: () => ({ maxHealth: 100 }),
    config: () => ({
      navalSectorSize: () => 64,
      warshipVeterancyHealthBonus: () => 10,
    }),
  } as unknown as GameView;
  const eventBus = new EventBus();
  const setLayerVisible = vi.fn();
  const updateMapLayerImage = vi.fn();
  const controller = new ResourceMapController(
    eventBus,
    {
      setLayerVisible,
      updateMapLayerImage,
    } as never,
    game,
  );
  controller.init();

  eventBus.emit(new ToggleNavalSectorMapEvent(true));
  await vi.waitFor(() => expect(updateMapLayerImage).toHaveBeenCalledOnce());

  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.tick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(updateMapLayerImage).toHaveBeenCalledOnce();

  shipHealth = 50;
  controller.tick();
  await vi.waitFor(() => expect(updateMapLayerImage).toHaveBeenCalledTimes(2));

  expect(canvas.width).toBe(100);
  expect(canvas.height).toBe(90);
  expect(fillRect).toHaveBeenCalledWith(0, 0, 64, 64);
  expect(updateMapLayerImage).toHaveBeenCalledWith(
    NAVAL_CONTROL_MAP_LAYER_ID,
    image,
  );
});
