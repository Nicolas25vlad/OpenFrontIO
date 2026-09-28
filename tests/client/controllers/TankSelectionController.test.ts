import { TankSelectionController } from "../../../src/client/controllers/TankSelectionController";
import { MouseUpEvent } from "../../../src/client/InputHandler";
import { MoveTankIntentEvent } from "../../../src/client/Transport";
import { EventBus } from "../../../src/core/EventBus";
import { UnitType } from "../../../src/core/game/Game";

describe("TankSelectionController", () => {
  test("selects a tank and orders it without involving infantry", () => {
    const player = {};
    const tank = {
      id: () => 9,
      type: () => UnitType.Tank,
      isActive: () => true,
      owner: () => player,
      tile: () => 101,
    };
    let targetX = 1;
    const game = {
      inSpawnPhase: () => false,
      isValidCoord: () => true,
      ref: (x: number, y: number) => y * 100 + x,
      isWater: () => false,
      myPlayer: () => player,
      units: (type: UnitType) => (type === UnitType.Tank ? [tank] : []),
      manhattanDist: (a: number, b: number) => Math.abs(a - b),
    };
    const eventBus = new EventBus();
    const sentOrders: MoveTankIntentEvent[] = [];
    const selectedIds: number[][] = [];
    eventBus.on(MoveTankIntentEvent, (event) => sentOrders.push(event));
    const controller = new TankSelectionController(
      game as never,
      eventBus,
      {
        screenToWorldCoordinates: () => ({ x: targetX, y: 1 }),
      } as never,
      { setSelectedUnits: (ids: number[]) => selectedIds.push(ids) } as never,
    );
    controller.init();

    eventBus.emit(new MouseUpEvent(0, 0));
    expect(selectedIds).toEqual([[9]]);

    targetX = 12;
    eventBus.emit(new MouseUpEvent(0, 0));
    expect(sentOrders).toEqual([new MoveTankIntentEvent([9], 112)]);
    expect(selectedIds[selectedIds.length - 1]).toEqual([]);
  });

  test("does not select tanks owned by another player", () => {
    const player = {};
    const enemyTank = {
      id: () => 2,
      type: () => UnitType.Tank,
      isActive: () => true,
      owner: () => ({}),
      tile: () => 101,
    };
    const eventBus = new EventBus();
    const selectedIds: number[][] = [];
    const controller = new TankSelectionController(
      {
        inSpawnPhase: () => false,
        isValidCoord: () => true,
        ref: (x: number, y: number) => y * 100 + x,
        isWater: () => false,
        myPlayer: () => player,
        units: () => [enemyTank],
        manhattanDist: (a: number, b: number) => Math.abs(a - b),
      } as never,
      eventBus,
      { screenToWorldCoordinates: () => ({ x: 1, y: 1 }) } as never,
      { setSelectedUnits: (ids: number[]) => selectedIds.push(ids) } as never,
    );
    controller.init();

    eventBus.emit(new MouseUpEvent(0, 0));

    expect(selectedIds).toEqual([]);
  });
});
