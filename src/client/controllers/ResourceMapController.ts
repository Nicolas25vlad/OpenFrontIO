import { EventBus } from "../../core/EventBus";
import { Controller } from "../Controller";
import {
  ToggleNavalSectorMapEvent,
  ToggleResourceMapEvent,
} from "../InputHandler";
import {
  NAVAL_SECTOR_MAP_LAYER_ID,
  RESOURCE_MAP_LAYER_ID,
} from "../ResourceMap";
import { MapRenderer } from "../render/gl";

export class ResourceMapController implements Controller {
  constructor(
    private readonly eventBus: EventBus,
    private readonly view: MapRenderer,
  ) {}

  init() {
    this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, false);
    this.view.setLayerVisible(NAVAL_SECTOR_MAP_LAYER_ID, false);
    this.eventBus.on(ToggleResourceMapEvent, (event) => {
      this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, event.visible);
    });
    this.eventBus.on(ToggleNavalSectorMapEvent, (event) => {
      this.view.setLayerVisible(NAVAL_SECTOR_MAP_LAYER_ID, event.visible);
    });
  }
}
