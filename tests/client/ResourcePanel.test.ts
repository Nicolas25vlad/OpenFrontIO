import { afterEach, expect, test, vi } from "vitest";
import { ResourcePanel } from "../../src/client/hud/layers/ResourcePanel";
import { ToggleNavalSectorMapEvent } from "../../src/client/InputHandler";
import { DispatchTradeRouteIntentEvent } from "../../src/client/Transport";
import { GameView } from "../../src/client/view";
import { EventBus } from "../../src/core/EventBus";
import { emptyResourceRates, FULL_SUPPLY } from "../../src/core/game/Economy";
import { UnitType } from "../../src/core/game/Game";
import {
  emptyResourceStock,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
vi.mock("../../src/client/Utils", () => ({
  translateText: (key: string) => key,
  renderNumber: String,
}));
vi.mock("../../src/client/ResourceMap", () => ({
  RESOURCE_COLORS: {},
  resourceIconUrl: () => "data:image/png;base64,",
}));

afterEach(() => document.body.replaceChildren());
test("shows actual stocks and all production balances; map toggle changes no stock", async () => {
  const stock = { ...emptyResourceStock(), iron: 321, steel: 40 };
  const rates = emptyResourceRates();
  rates.production.steel = 7;
  rates.consumption.steel = 3;
  const mine = {
    type: () => UnitType.Mine,
    id: () => 9,
    productionStatus: () => ({
      efficiency: 100,
      urbanBonus: 0,
      infrastructureBonus: 0,
      produced: 5,
      shortage: false,
      exhausted: false,
      resourceOutputs: { iron: 3, coal: 2 },
      depositConcentrations: { iron: 72, coal: 48 },
    }),
  };
  const panel = new ResourcePanel();
  panel.game = {
    config: () => ({
      strategicEconomy: () => true,
      navalSectorSize: () => 64,
      warshipVeterancyHealthBonus: () => 20,
    }),
    unitInfo: () => ({ maxHealth: 1000 }),
    units: (type?: UnitType) => (type === UnitType.Mine ? [mine] : []),
    myPlayer: () => ({
      resourceAmount: (resource: keyof typeof stock) => stock[resource],
      resourceRates: () => rates,
      supplyStatus: () => FULL_SUPPLY,
      tanks: () => 0,
      units: (type?: UnitType) =>
        type === undefined || type === UnitType.Mine ? [mine] : [],
    }),
  } as unknown as GameView;
  panel.eventBus = new EventBus();
  document.body.append(panel);
  panel.init();
  await panel.updateComplete;
  expect(panel.textContent).toContain("321");
  expect(panel.textContent).toContain("economy.extracting");
  expect(panel.textContent).toContain("resource.iron: +3");
  expect(panel.textContent).toContain("resource.coal: +2");
  expect(panel.textContent).toContain("resource.iron: 72%");
  expect(panel.textContent).toContain("resource.coal: 48%");
  expect(panel.textContent).toMatch(/economy\.tank_supply:\s+100%/);
  expect(panel.querySelectorAll("tbody tr")).toHaveLength(
    STOCK_RESOURCES.length,
  );
  const row = [...panel.querySelectorAll("tbody tr")].find((r) =>
    r.textContent?.includes("resource.steel"),
  )!;
  expect(
    [...row.querySelectorAll("td")].map((c) => c.textContent?.trim()),
  ).toEqual(["40", "+7", "−3", "4"]);
  const before = { ...stock };
  panel.querySelector("button")!.click();
  await panel.updateComplete;
  expect(panel.querySelector("button")!.getAttribute("aria-pressed")).toBe(
    "true",
  );
  expect(stock).toEqual(before);
});

test("shows owned-port sectors and active trade routes", async () => {
  const me = {
    isMe: () => true,
    isFriendly: () => false,
    displayName: () => "Me",
    hasEmbargo: () => false,
  };
  const trader = {
    isMe: () => false,
    isFriendly: () => false,
    displayName: () => "Trader",
  };
  const port = {
    type: () => UnitType.Port,
    id: () => 6,
    isActive: () => true,
    isUnderConstruction: () => false,
    isMarkedForDeletion: () => false,
    markedForDeletion: () => false,
    tile: () => 10,
    owner: () => me,
  };
  const destinationPort = {
    type: () => UnitType.Port,
    id: () => 7,
    isActive: () => true,
    isUnderConstruction: () => false,
    isMarkedForDeletion: () => false,
    markedForDeletion: () => false,
    tile: () => 75,
    owner: () => trader,
  };
  const playerPort = {
    ...port,
    id: () => 8,
    tile: () => 18,
  };
  const warship = (
    owner: unknown,
    tile: number,
    health = 1000,
    level = 1,
    veterancy = 0,
  ) => ({
    isActive: () => true,
    isUnderConstruction: () => false,
    warshipState: () => ({ state: "patrolling" }),
    tile: () => tile,
    owner: () => owner,
    health: () => health,
    level: () => level,
    veterancy: () => veterancy,
  });
  const tradeShip = {
    targetUnitId: () => 8,
    owner: () => trader,
  };
  const player = {
    units: (type?: UnitType) => (type === UnitType.Port ? [port] : []),
    hasEmbargo: () => false,
    resourceAmount: () => 0,
    resourceRates: () => emptyResourceRates(),
    supplyStatus: () => FULL_SUPPLY,
    tanks: () => 0,
  };
  const panel = new ResourcePanel();
  panel.game = {
    config: () => ({
      strategicEconomy: () => true,
      navalSectorSize: () => 64,
      warshipVeterancyHealthBonus: () => 20,
    }),
    myPlayer: () => player,
    x: (tile: number) => tile,
    y: () => 0,
    unitInfo: () => ({ maxHealth: 1000 }),
    units: (type: UnitType) =>
      type === UnitType.Port
        ? [port, destinationPort, playerPort]
        : type === UnitType.Warship
          ? [
              warship(me, 12, 600, 2, 1),
              warship(trader, 20, 1000, 2),
              warship(trader, 70, 1000, 5),
            ]
          : type === UnitType.TradeShip
            ? [tradeShip]
            : [],
    unit: (id: number) => (id === 8 ? playerPort : undefined),
  } as unknown as GameView;
  panel.eventBus = new EventBus();
  const navalMapToggle = vi.fn();
  const dispatchedRoute = vi.fn();
  panel.eventBus.on(ToggleNavalSectorMapEvent, (event) =>
    navalMapToggle(event.visible),
  );
  panel.eventBus.on(DispatchTradeRouteIntentEvent, (event) =>
    dispatchedRoute(event.sourcePortID, event.destinationPortID),
  );
  document.body.append(panel);
  panel.init();
  await panel.updateComplete;

  expect(panel.textContent).toContain("economy.naval_status");
  expect(panel.textContent).toContain("economy.naval_sectors");
  expect(panel.textContent).toContain("1.0+");
  expect(panel.textContent).toContain("2.0−");
  expect(panel.textContent).not.toContain("5.0−");
  expect(panel.textContent?.replace(/\s+/g, " ")).toContain("Trader → Me");
  expect(panel.textContent).toContain("economy.in_transit");
  expect(panel.textContent).toContain("naval_map.dispatch_route");

  const toggle = panel.querySelector<HTMLButtonElement>(
    'button[aria-label="naval_map.button"]',
  )!;
  toggle.click();
  await panel.updateComplete;
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(panel.textContent).toContain("naval_map.legend");
  expect(navalMapToggle).toHaveBeenCalledWith(true);

  const routeDetails = [...panel.querySelectorAll("details")].find((item) =>
    item.textContent?.includes("naval_map.dispatch_route"),
  )!;
  (routeDetails.querySelector("summary") as HTMLElement).click();
  await panel.updateComplete;
  const dispatchButton = [...routeDetails.querySelectorAll("button")].find(
    (button) => button.textContent?.includes("naval_map.dispatch"),
  )!;
  dispatchButton.click();
  expect(dispatchedRoute).toHaveBeenCalledWith(6, 7);
});
