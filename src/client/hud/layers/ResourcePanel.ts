import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import {
  NaturalResource,
  ProcessedResource,
  RESOURCE_VALUES,
  ResourceType,
  STOCK_RESOURCES,
} from "../../../core/game/Resources";
import { Controller } from "../../Controller";
import { ToggleResourceMapEvent } from "../../InputHandler";
import { RESOURCE_COLORS, resourceIconUrl } from "../../ResourceMap";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";

const PRODUCT_ICONS: Record<ProcessedResource, string> = {
  fuel: "⛽",
  refined_iron: "▰",
  steel: "⚙",
  gold_bars: "▰",
  circuits: "▦",
  enriched_uranium: "☢",
  fertilizer: "❋",
  food: "🌾",
};

@customElement("resource-panel")
export class ResourcePanel extends LitElement implements Controller {
  public game!: GameView;
  public eventBus!: EventBus;
  @state() private mapVisible = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleResourceMapEvent, (event) => {
      this.mapVisible = event.visible;
    });
    this.tick();
  }

  getTickIntervalMs() {
    return 1000;
  }
  tick() {
    this.requestUpdate();
  }

  private icon(resource: ResourceType) {
    return RESOURCE_VALUES.includes(resource as NaturalResource)
      ? html`<img
          src=${resourceIconUrl(resource as NaturalResource)}
          alt=""
          class="size-5 shrink-0"
          style="image-rendering:pixelated"
        />`
      : html`<span
          aria-hidden="true"
          class="inline-flex size-5 items-center justify-center"
          >${PRODUCT_ICONS[resource as ProcessedResource]}</span
        >`;
  }

  render() {
    const player = this.game?.myPlayer();
    if (!player || !this.game.config().strategicEconomy()) return null;
    const rates = player.resourceRates();
    const compact = [
      ...RESOURCE_VALUES,
      ProcessedResource.Food,
      ProcessedResource.Fuel,
      ProcessedResource.Steel,
    ];
    const buildings = player.units().filter((unit) => unit.productionStatus());
    return html` <aside
      class="w-fit min-w-[14rem] max-w-[21rem] p-2 bg-gray-950/95 shadow-xs rounded-lg text-white text-xs"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex items-center justify-between gap-3 mb-1">
        <span class="text-[10px] uppercase tracking-wide text-gray-300"
          >${translateText("economy.stock")}</span
        >
        <button
          class="border rounded-sm px-2 py-1 ${this.mapVisible
            ? "bg-emerald-400/20 border-emerald-300"
            : "border-emerald-700 hover:bg-gray-700"}"
          aria-label=${translateText("resource_map.button")}
          aria-pressed=${this.mapVisible}
          title=${translateText("resource_map.toggle")}
          @click=${() =>
            this.eventBus.emit(new ToggleResourceMapEvent(!this.mapVisible))}
        >
          ◎ ${translateText("resource_map.button")}
        </button>
      </div>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1">
        ${compact.map(
          (resource) =>
            html` <span
              class="flex items-center justify-between gap-2"
              title=${translateText(`resource.${resource}`)}
            >
              <span
                class="flex items-center gap-1"
                style="color:${RESOURCE_COLORS[resource as NaturalResource] ??
                "#f1f5f9"}"
              >
                ${this.icon(resource)}${translateText(`resource.${resource}`)}
              </span>
              <strong class="tabular-nums"
                >${renderNumber(player.resourceAmount(resource))}</strong
              >
            </span>`,
        )}
      </div>
      <div
        class="flex justify-between gap-2 text-[11px]"
        title=${translateText("economy.supply_hint")}
      >
        <span
          >${translateText("economy.supply")}:
          ${player.supplyStatus().infantry}%</span
        >
        <span
          >${translateText("economy.naval_supply")}:
          ${player.supplyStatus().navy}%</span
        >
      </div>
      <details class="mt-2 border-t border-white/15 pt-1">
        <summary class="cursor-pointer text-emerald-300">
          ${translateText("economy.details")}
        </summary>
        <div class="max-h-[35vh] overflow-auto">
          <p class="text-[10px] text-gray-400 py-1">
            ${translateText("economy.period")}
          </p>
          <table class="w-full text-right tabular-nums">
            <thead class="text-[10px] text-gray-300">
              <tr>
                <th class="text-left">${translateText("economy.resource")}</th>
                ${["stock", "produced", "consumed", "balance"].map(
                  (key) =>
                    html`<th class="px-1">
                      ${translateText(`economy.${key}`)}
                    </th>`,
                )}
              </tr>
            </thead>
            <tbody>
              ${STOCK_RESOURCES.map((resource) => {
                const made = rates?.production[resource] ?? 0;
                const used = rates?.consumption[resource] ?? 0;
                return html`<tr class="border-t border-white/5">
                  <th class="text-left font-normal">
                    <span class="flex items-center gap-1"
                      >${this.icon(resource)}${translateText(
                        `resource.${resource}`,
                      )}</span
                    >
                  </th>
                  <td>${renderNumber(player.resourceAmount(resource))}</td>
                  <td class="text-emerald-300">+${made}</td>
                  <td class="text-orange-300">−${used}</td>
                  <td
                    class=${made >= used ? "text-emerald-300" : "text-red-300"}
                  >
                    ${made - used}
                  </td>
                </tr>`;
              })}
            </tbody>
          </table>
          ${buildings.map((unit) => {
            const status = unit.productionStatus()!;
            return html`<div
              class="mt-1 border-t border-white/10 py-1"
              title=${translateText("economy.bonuses", {
                urban: status.urbanBonus,
                infrastructure: status.infrastructureBonus,
              })}
            >
              ${translateText(
                `unit_type.${unit.type().toLowerCase().replace(/ /g, "_")}`,
              )}
              #${unit.id()}: ${status.efficiency}% · ${status.produced}
              <span class="text-amber-300"
                >${status.exhausted
                  ? translateText("economy.exhausted")
                  : status.shortage
                    ? translateText("economy.shortage")
                    : ""}</span
              >
            </div>`;
          })}
        </div>
      </details>
    </aside>`;
  }
}
