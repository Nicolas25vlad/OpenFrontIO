import { afterEach, expect, test, vi } from "vitest";
import { ResourcePanel } from "../../src/client/hud/layers/ResourcePanel";
import { GameView } from "../../src/client/view";
import { EventBus } from "../../src/core/EventBus";
import { emptyResourceRates, FULL_SUPPLY } from "../../src/core/game/Economy";
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
    config: () => ({ strategicEconomy: () => true }),
    myPlayer: () => ({
      resourceAmount: (resource: keyof typeof stock) => stock[resource],
      resourceRates: () => rates,
      supplyStatus: () => FULL_SUPPLY,
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
