import { EventBus } from "../../core/EventBus";
import { UnitType } from "../../core/game/Game";
import { maxHealthWithVeterancy } from "../../core/game/Veterancy";
import { Controller } from "../Controller";
import {
  ToggleNavalSectorMapEvent,
  ToggleResourceMapEvent,
} from "../InputHandler";
import { MapRenderer } from "../render/gl";
import {
  createNavalControlMapImage,
  NAVAL_CONTROL_MAP_LAYER_ID,
  NAVAL_SECTOR_MAP_LAYER_ID,
  RESOURCE_MAP_LAYER_ID,
} from "../ResourceMap";
import type { GameView } from "../view/GameView";

export class ResourceMapController implements Controller {
  private navalMapVisible = false;
  private updatingNavalMap = false;
  private lastNavalSignature: string | null = null;

  constructor(
    private readonly eventBus: EventBus,
    private readonly view: MapRenderer,
    private readonly game: GameView,
  ) {}

  init() {
    this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, false);
    this.view.setLayerVisible(NAVAL_CONTROL_MAP_LAYER_ID, false);
    this.view.setLayerVisible(NAVAL_SECTOR_MAP_LAYER_ID, false);
    this.eventBus.on(ToggleResourceMapEvent, (event) => {
      this.view.setLayerVisible(RESOURCE_MAP_LAYER_ID, event.visible);
    });
    this.eventBus.on(ToggleNavalSectorMapEvent, (event) => {
      this.navalMapVisible = event.visible;
      this.view.setLayerVisible(NAVAL_CONTROL_MAP_LAYER_ID, event.visible);
      this.view.setLayerVisible(NAVAL_SECTOR_MAP_LAYER_ID, event.visible);
      if (event.visible) this.updateNavalMap();
    });
  }

  getTickIntervalMs(): number {
    return 500;
  }

  tick(): void {
    if (this.navalMapVisible) this.updateNavalMap();
  }

  private updateNavalMap(): void {
    if (this.updatingNavalMap) return;
    const player = this.game.myPlayer();
    if (!player) return;

    const sectorSize = this.game.config().navalSectorSize();
    const baseHealth = this.game.unitInfo(UnitType.Warship).maxHealth ?? 1;
    const veterancyHealthBonus = this.game
      .config()
      .warshipVeterancyHealthBonus();
    const sectors = new Map<
      string,
      { x: number; y: number; friendly: number; hostile: number }
    >();
    for (const ship of this.game.units(UnitType.Warship)) {
      if (
        !ship.isActive() ||
        ship.isUnderConstruction() ||
        ship.warshipState().state === "docked"
      ) {
        continue;
      }
      const x = Math.floor(this.game.x(ship.tile()) / sectorSize);
      const y = Math.floor(this.game.y(ship.tile()) / sectorSize);
      const key = `${x},${y}`;
      const sector = sectors.get(key) ?? { x, y, friendly: 0, hostile: 0 };
      const maxHealth = maxHealthWithVeterancy(
        baseHealth,
        ship.veterancy(),
        veterancyHealthBonus,
      );
      const strength = (ship.health() / Math.max(1, maxHealth)) * ship.level();
      const owner = ship.owner();
      if (owner.isMe() || owner.isFriendly(player)) {
        sector.friendly += strength;
      } else {
        sector.hostile += strength;
      }
      sectors.set(key, sector);
    }

    const summary = [...sectors.values()].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    );
    const signature = `${sectorSize}|${summary
      .map(
        (sector) =>
          `${sector.x},${sector.y}:${sector.friendly.toFixed(2)}:${sector.hostile.toFixed(2)}`,
      )
      .join("|")}`;
    if (signature === this.lastNavalSignature) return;

    this.updatingNavalMap = true;
    void createNavalControlMapImage(this.game, sectorSize, summary)
      .then((image) => {
        this.lastNavalSignature = signature;
        this.view.updateMapLayerImage(NAVAL_CONTROL_MAP_LAYER_ID, image);
      })
      .catch((error) => {
        console.warn(
          "[ResourceMapController] Failed to update naval map:",
          error,
        );
      })
      .finally(() => {
        this.updatingNavalMap = false;
      });
  }
}
