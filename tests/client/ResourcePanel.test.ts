import { afterEach, expect, test, vi } from "vitest";
import { ResourcePanel } from "../../src/client/hud/layers/ResourcePanel";
import { ToggleNavalSectorMapEvent } from "../../src/client/InputHandler";
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
  const panel = new ResourcePanel();
  panel.game = {
    config: () => ({ strategicEconomy: () => true, navalSectorSize: () => 64 }),
    units: () => [],
    myPlayer: () => ({
      resourceAmount: (resource: keyof typeof stock) => stock[resource],
      resourceRates: () => rates,
      supplyStatus: () => FULL_SUPPLY,
      tanks: () => 0,
      units: () => [],
    }),
  } as unknown as GameView;
  panel.eventBus = new EventBus();
  document.body.append(panel);
  panel.init();
  await panel.updateComplete;
  expect(panel.textContent).toContain("321");
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
  };
  const trader = {
    isMe: () => false,
    isFriendly: () => false,
    displayName: () => "Trader",
  };
  const port = {
    type: () => UnitType.Port,
    isActive: () => true,
    tile: () => 10,
    owner: () => me,
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
    targetUnitId: () => 7,
    owner: () => trader,
  };
  const player = {
    units: (type?: UnitType) => (type === UnitType.Port ? [port] : []),
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
      type === UnitType.Warship
        ? [
            warship(me, 12, 600, 2, 1),
            warship(trader, 20, 1000, 2),
            warship(trader, 70, 1000, 5),
          ]
        : type === UnitType.TradeShip
          ? [tradeShip]
          : [],
    unit: (id: number) => (id === 7 ? port : undefined),
  } as unknown as GameView;
  panel.eventBus = new EventBus();
  const navalMapToggle = vi.fn();
  panel.eventBus.on(ToggleNavalSectorMapEvent, (event) =>
    navalMapToggle(event.visible),
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

  const toggle = panel.querySelector<HTMLButtonElement>(
    'button[aria-label="naval_map.button"]',
  )!;
  toggle.click();
  await panel.updateComplete;
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  expect(navalMapToggle).toHaveBeenCalledWith(true);
});
