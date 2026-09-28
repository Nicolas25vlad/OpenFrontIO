import { render } from "lit";
import "../../../../src/client/hud/layers/BuildMenu";
import type { BuildMenu } from "../../../../src/client/hud/layers/BuildMenu";
import { BuildTrenchIntentEvent } from "../../../../src/client/Transport";
import type { GameView } from "../../../../src/client/view/GameView";
import { EventBus } from "../../../../src/core/EventBus";
import { ProcessedResource } from "../../../../src/core/game/Resources";

describe("BuildMenu trench option", () => {
  function mountOption({
    strategicEconomy = true,
    isBorder = true,
    trenchLevel = 0,
    steel = 3,
  }: {
    strategicEconomy?: boolean;
    isBorder?: boolean;
    trenchLevel?: number;
    steel?: number;
  } = {}) {
    const tile = 42;
    const player = {
      smallID: () => 7,
      resourceAmount: (resource: ProcessedResource) =>
        resource === ProcessedResource.Steel ? steel : 0,
    };
    const game = {
      config: () => ({
        strategicEconomy: () => strategicEconomy,
        trenchMaxLevel: () => 3,
        trenchCost: () => ({ [ProcessedResource.Steel]: 3 }),
      }),
      myPlayer: () => player,
      ownerID: () => 7,
      isBorder: () => isBorder,
      trenchLevel: () => trenchLevel,
    } as unknown as GameView;
    const eventBus = new EventBus();
    const menu = document.createElement("build-menu") as BuildMenu;
    menu.game = game;
    menu.eventBus = eventBus;
    (menu as any).clickedTile = tile;

    const container = document.createElement("div");
    render((menu as any).renderTrenchOption(), container);
    return { container, eventBus, menu, tile };
  }

  it("shows the current level and emits the trench intent for an eligible tile", () => {
    const { container, eventBus, tile } = mountOption({ trenchLevel: 1 });
    let sent: BuildTrenchIntentEvent | undefined;
    eventBus.on(BuildTrenchIntentEvent, (event) => (sent = event));

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toContain("1/3");
    button?.click();

    expect(sent).toBeInstanceOf(BuildTrenchIntentEvent);
    expect(sent?.tile).toBe(tile);
  });

  it.each([
    { label: "outside the frontier", isBorder: false, steel: 3, level: 0 },
    { label: "without enough steel", isBorder: true, steel: 2, level: 0 },
    { label: "at maximum level", isBorder: true, steel: 3, level: 3 },
  ])("disables the option $label", ({ isBorder, steel, level }) => {
    const { container } = mountOption({
      isBorder,
      steel,
      trenchLevel: level,
    });

    expect(container.querySelector("button")?.disabled).toBe(true);
  });

  it("hides trench construction in legacy economy", () => {
    const { container } = mountOption({ strategicEconomy: false });

    expect(container.querySelector("button")).toBeNull();
  });
});
