import { expect, test, vi } from "vitest";
import { ResourceMapController } from "../../src/client/controllers/ResourceMapController";
import {
  ToggleNavalSectorMapEvent,
  ToggleResourceMapEvent,
} from "../../src/client/InputHandler";
import {
  NAVAL_SECTOR_MAP_LAYER_ID,
  RESOURCE_MAP_LAYER_ID,
} from "../../src/client/ResourceMap";
import { EventBus } from "../../src/core/EventBus";

test("controls resource and naval sector layers independently", () => {
  const eventBus = new EventBus();
  const setLayerVisible = vi.fn();
  const controller = new ResourceMapController(eventBus, {
    setLayerVisible,
  } as never);
  controller.init();

  expect(setLayerVisible).toHaveBeenNthCalledWith(
    1,
    RESOURCE_MAP_LAYER_ID,
    false,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    2,
    NAVAL_SECTOR_MAP_LAYER_ID,
    false,
  );

  eventBus.emit(new ToggleResourceMapEvent(true));
  eventBus.emit(new ToggleNavalSectorMapEvent(true));
  eventBus.emit(new ToggleResourceMapEvent(false));

  expect(setLayerVisible).toHaveBeenNthCalledWith(
    3,
    RESOURCE_MAP_LAYER_ID,
    true,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    4,
    NAVAL_SECTOR_MAP_LAYER_ID,
    true,
  );
  expect(setLayerVisible).toHaveBeenNthCalledWith(
    5,
    RESOURCE_MAP_LAYER_ID,
    false,
  );
});
