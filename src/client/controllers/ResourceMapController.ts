import { EventBus } from "../../core/EventBus";
import { Controller } from "../Controller";
import { ToggleResourceMapEvent } from "../InputHandler";
import { RESOURCE_MAP_LAYER_ID } from "../ResourceMap";
import { MapRenderer } from "../render/gl";

export class ResourceMapController implements Controller {
  constructor(
    private readonly eventBus: EventBus,
    private readonly view: MapRenderer,
  ) {}

  init() {
    this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, false);
    this.eventBus.on(ToggleResourceMapEvent, (event) => {
      this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, event.visible);
    });
  }
}
