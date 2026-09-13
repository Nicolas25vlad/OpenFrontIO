/**
 * MapLayerController — loads map-layer images (off the critical path) and
 * applies initial visibility from user settings.
 *
 * The renderer tolerates missing layers (warn + skip) until images arrive,
 * so the game starts without blocking on layer PNGs.
 */

import { GameMapSize, GameMapType } from "../../core/game/Game";
import { GameMapLoader } from "../../core/game/GameMapLoader";
import {
  loadLayerImages,
  TerrainMapData,
} from "../../core/game/TerrainMapLoader";
import { UserSettings } from "../../core/game/UserSettings";
import { Controller } from "../Controller";
import { createResourceMapImage, RESOURCE_MAP_LAYER_ID } from "../ResourceMap";
import { MapRenderer } from "../render/gl";

export class MapLayerController implements Controller {
  constructor(
    private readonly view: MapRenderer,
    private readonly gameMap: TerrainMapData,
    private readonly userSettings: UserSettings,
    private readonly gameMapType: GameMapType,
    private readonly gameMapSize: GameMapSize,
    private readonly mapLoader: GameMapLoader,
    private readonly matchSeed: string,
    private readonly abortSignal: AbortSignal,
  ) {}

  init() {
    if (this.gameMap.layerImages) {
      void this.installLayers(
        this.gameMap.layers ?? [],
        this.gameMap.layerImages,
      );
    } else {
      const baseImages = this.gameMap.layers?.length
        ? loadLayerImages(
            this.gameMapType,
            this.gameMapSize,
            this.mapLoader,
            this.gameMap.layers,
          )
        : Promise.resolve(new Map<string, ImageBitmap>());
      baseImages
        .then((images) => {
          if (!this.abortSignal.aborted) {
            void this.installLayers(this.gameMap.layers ?? [], images);
          }
        })
        .catch((e) =>
          console.warn("[MapLayerController] Failed to load layer images:", e),
        );
    }
  }

  private async installLayers(
    baseLayers: NonNullable<TerrainMapData["layers"]>,
    baseImages: Map<string, ImageBitmap>,
  ) {
    const layers = [...baseLayers];
    const images = new Map(baseImages);
    try {
      images.set(
        RESOURCE_MAP_LAYER_ID,
        await createResourceMapImage(this.gameMap.gameMap, this.matchSeed),
      );
      layers.push({
        id: RESOURCE_MAP_LAYER_ID,
        placement: "land",
        alpha: 0.95,
      });
    } catch (e) {
      console.warn("[MapLayerController] Failed to create resource map:", e);
    }
    if (this.abortSignal.aborted) return;
    this.view.setMapLayers(layers, images);
    this.applyVisibility(layers);
    this.applyAlpha(layers);
    this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, false);
  }

  private applyVisibility(layers: NonNullable<TerrainMapData["layers"]>) {
    const overrides = this.userSettings.graphicsOverrides();
    if (!overrides.mapLayerVisibility) return;
    for (const layer of layers) {
      const vis = overrides.mapLayerVisibility[layer.id];
      if (vis !== undefined) {
        this.view.setLayerVisible(layer.id, vis);
      }
    }
  }

  private applyAlpha(layers: NonNullable<TerrainMapData["layers"]>) {
    const overrides = this.userSettings.graphicsOverrides();
    for (const layer of layers) {
      const alpha = overrides.mapLayerAlpha?.[layer.id];
      if (alpha !== undefined) {
        this.view.setLayerAlpha(layer.id, alpha);
      } else if (layer.alpha !== undefined) {
        // Apply manifest default when no user override exists.
        this.view.setLayerAlpha(layer.id, layer.alpha);
      }
    }
  }
}
