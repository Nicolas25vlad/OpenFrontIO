import { EventBus } from "../../core/EventBus";
import { UnitType } from "../../core/game/Game";
import { TileRef } from "../../core/game/GameMap";
import { Controller } from "../Controller";
import {
  CloseViewEvent,
  MouseUpEvent,
  TouchEvent,
  UnitSelectionEvent,
} from "../InputHandler";
import { MapRenderer } from "../render/gl";
import { TransformHandler } from "../TransformHandler";
import { MoveTankIntentEvent } from "../Transport";
import { GameView, UnitView } from "../view";

const TANK_SELECTION_RADIUS = 5;

/** Selects one deployed tank and sends movement orders without selecting troops. */
export class TankSelectionController implements Controller {
  private selectedTank: UnitView | null = null;

  constructor(
    private readonly game: GameView,
    private readonly eventBus: EventBus,
    private readonly transformHandler: TransformHandler,
    private readonly view: MapRenderer,
  ) {}

  init(): void {
    this.eventBus.on(UnitSelectionEvent, (event) =>
      this.onUnitSelection(event),
    );
    this.eventBus.on(MouseUpEvent, (event) => this.onMouseUp(event));
    this.eventBus.on(TouchEvent, (event) => this.onTouch(event));
    this.eventBus.on(CloseViewEvent, () => this.clearSelection());
  }

  tick(): void {
    if (this.selectedTank && !this.selectedTank.isActive()) {
      this.clearSelection();
    }
  }

  private onMouseUp(event: MouseUpEvent): void {
    if (this.game.inSpawnPhase()) return;
    const clickRef = this.resolveClick(event.x, event.y);
    if (clickRef === null || this.game.isWater(clickRef)) return;
    this.handleLandClick(clickRef);
  }

  private onTouch(event: TouchEvent): void {
    if (this.game.inSpawnPhase()) return;
    const clickRef = this.resolveClick(event.x, event.y);
    if (clickRef === null || this.game.isWater(clickRef)) return;
    if (this.selectedTank || this.findTanksNearCell(clickRef).length > 0) {
      this.handleLandClick(clickRef);
    }
  }

  private resolveClick(x: number, y: number): TileRef | null {
    const cell = this.transformHandler.screenToWorldCoordinates(x, y);
    if (!this.game.isValidCoord(cell.x, cell.y)) return null;
    return this.game.ref(cell.x, cell.y);
  }

  private handleLandClick(clickRef: TileRef): void {
    const nearbyTanks = this.findTanksNearCell(clickRef);
    if (
      this.selectedTank &&
      nearbyTanks.some((tank) => tank.id() !== this.selectedTank?.id())
    ) {
      this.eventBus.emit(new UnitSelectionEvent(nearbyTanks[0], true));
      return;
    }

    if (this.selectedTank) {
      this.eventBus.emit(
        new MoveTankIntentEvent([this.selectedTank.id()], clickRef),
      );
      this.clearSelection();
      return;
    }

    const tank = nearbyTanks[0];
    if (tank) this.eventBus.emit(new UnitSelectionEvent(tank, true));
  }

  private findTanksNearCell(clickRef: TileRef): UnitView[] {
    const player = this.game.myPlayer();
    if (!player) return [];
    return this.game
      .units(UnitType.Tank)
      .filter(
        (tank) =>
          tank.isActive() &&
          tank.owner() === player &&
          this.game.manhattanDist(tank.tile(), clickRef) <=
            TANK_SELECTION_RADIUS,
      )
      .sort(
        (a, b) =>
          this.game.manhattanDist(a.tile(), clickRef) -
          this.game.manhattanDist(b.tile(), clickRef),
      );
  }

  private onUnitSelection(event: UnitSelectionEvent): void {
    if (!event.isSelected) {
      this.selectedTank = null;
      this.view.setSelectedUnits([]);
      return;
    }
    if (event.units.length > 0 || event.unit?.type() !== UnitType.Tank) {
      this.selectedTank = null;
      return;
    }
    this.selectedTank = event.unit;
    this.view.setSelectedUnits([event.unit.id()]);
  }

  private clearSelection(): void {
    this.selectedTank = null;
    this.view.setSelectedUnits([]);
  }
}
