import "../../../../src/client/hud/layers/BuildMenu";
import type { BuildMenu } from "../../../../src/client/hud/layers/BuildMenu";
import { MouseUpEvent } from "../../../../src/client/InputHandler";
import {
  BuildTrenchIntentEvent,
  StartTrenchPlacementEvent,
} from "../../../../src/client/Transport";
import type { GameView } from "../../../../src/client/view/GameView";
import { EventBus } from "../../../../src/core/EventBus";
import { ProcessedResource } from "../../../../src/core/game/Resources";

describe("BuildMenu trench placement", () => {
  function mountPlacement() {
    const menu = document.createElement("build-menu") as BuildMenu;
    const eventBus = new EventBus();
    const game = {
      config: () => ({
        strategicEconomy: () => true,
        trenchMaxLevel: () => 3,
        trenchCost: () => ({ [ProcessedResource.Steel]: 3 }),
      }),
      myPlayer: () => ({
        smallID: () => 7,
        resourceAmount: () => 3,
      }),
      isValidCoord: (x: number, y: number) => x >= 0 && x < 10 && y === 0,
      ref: (x: number, y: number) => y * 10 + x,
      x: (tile: number) => tile % 10,
      y: (tile: number) => Math.floor(tile / 10),
      ownerID: () => 7,
      isBorder: () => true,
      isLand: () => true,
      isImpassable: () => false,
      trenchLevel: () => 0,
    } as unknown as GameView;
    menu.game = game;
    menu.eventBus = eventBus;
    menu.transformHandler = {
      screenToWorldCoordinates: (x: number) => ({ x, y: 0 }),
    } as any;
    menu.init();
    eventBus.emit(new StartTrenchPlacementEvent());
    return { eventBus, menu };
  }

  it("turns one valid map click into one point intent", () => {
    const { eventBus } = mountPlacement();
    let sent: BuildTrenchIntentEvent | undefined;
    eventBus.on(BuildTrenchIntentEvent, (event) => (sent = event));

    eventBus.emit(new MouseUpEvent(2, 0));

    expect(sent?.tile).toBe(2);
  });

  it("does not send an intent for a click outside the map", () => {
    const { eventBus } = mountPlacement();
    let sent: BuildTrenchIntentEvent | undefined;
    eventBus.on(BuildTrenchIntentEvent, (event) => (sent = event));

    eventBus.emit(new MouseUpEvent(10, 0));

    expect(sent).toBeUndefined();
  });
});
