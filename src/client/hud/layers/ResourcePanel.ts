import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import { UnitType } from "../../../core/game/Game";
import {
  NaturalResource,
  ProcessedResource,
  RESOURCE_VALUES,
  ResourceType,
  STOCK_RESOURCES,
} from "../../../core/game/Resources";
import { Controller } from "../../Controller";
import {
  ToggleNavalSectorMapEvent,
  ToggleResourceMapEvent,
} from "../../InputHandler";
import { RESOURCE_COLORS, resourceIconUrl } from "../../ResourceMap";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
import { UnitView } from "../../view/UnitView";

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
  @state() private navalMapVisible = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.eventBus.on(ToggleResourceMapEvent, (event) => {
      this.mapVisible = event.visible;
    });
    this.eventBus.on(ToggleNavalSectorMapEvent, (event) => {
      this.navalMapVisible = event.visible;
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

  private navalSectorSummary(ports: UnitView[]) {
    if (ports.length === 0) return [];
    const player = this.game.myPlayer()!;
    const sectorSize = this.game.config().navalSectorSize();
    const sectors = new Map<
      string,
      { x: number; y: number; ports: number; friendly: number; hostile: number }
    >();
    for (const port of ports) {
      const x = Math.floor(this.game.x(port.tile()) / sectorSize);
      const y = Math.floor(this.game.y(port.tile()) / sectorSize);
      const key = `${x},${y}`;
      const sector = sectors.get(key) ?? {
        x,
        y,
        ports: 0,
        friendly: 0,
        hostile: 0,
      };
      sector.ports++;
      sectors.set(key, sector);
    }

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
      const sector = sectors.get(`${x},${y}`);
      if (sector === undefined) continue;
      if (ship.owner().isMe() || ship.owner().isFriendly(player)) {
        sector.friendly++;
      } else {
        sector.hostile++;
      }
    }
    return [...sectors.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  }

  private activeTradeRoutes() {
    const player = this.game.myPlayer();
    if (!player) return [];
    const sectorSize = this.game.config().navalSectorSize();
    return this.game.units(UnitType.TradeShip).flatMap((ship) => {
      const targetID = ship.targetUnitId();
      const port =
        targetID === undefined ? undefined : this.game.unit(targetID);
      if (
        port?.type() !== UnitType.Port ||
        !port.isActive() ||
        (!ship.owner().isMe() &&
          !ship.owner().isFriendly(player) &&
          !port.owner().isMe() &&
          !port.owner().isFriendly(player))
      ) {
        return [];
      }
      const x = Math.floor(this.game.x(port.tile()) / sectorSize);
      const y = Math.floor(this.game.y(port.tile()) / sectorSize);
      return [{ ship, port, x, y }];
    });
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
    const navalSectors = this.navalSectorSummary(player.units(UnitType.Port));
    const tradeRoutes = this.activeTradeRoutes();
    return html` <aside
      class="w-fit min-w-[14rem] max-w-[21rem] p-2 bg-gray-950/95 shadow-xs rounded-lg text-white text-xs"
      @contextmenu=${(e: Event) => e.preventDefault()}
    >
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-[10px] uppercase tracking-wide text-gray-300"
          >${translateText("economy.stock")}</span
        >
        <div class="flex items-center gap-1">
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
          <button
            class="border rounded-sm px-2 py-1 ${this.navalMapVisible
              ? "bg-sky-400/20 border-sky-300"
              : "border-sky-800 hover:bg-gray-700"}"
            aria-label=${translateText("naval_map.button")}
            aria-pressed=${this.navalMapVisible}
            title=${translateText("naval_map.toggle")}
            @click=${() =>
              this.eventBus.emit(
                new ToggleNavalSectorMapEvent(!this.navalMapVisible),
              )}
          >
            ⚓ ${translateText("naval_map.button")}
          </button>
        </div>
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
      <div class="flex justify-between gap-2 border-t border-white/10 pt-1">
        <span>🛡 ${translateText("economy.tanks")}</span>
        <strong class="tabular-nums">${renderNumber(player.tanks())}</strong>
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
      ${navalSectors.length > 0 || tradeRoutes.length > 0
        ? html`<details class="mt-2 border-t border-white/15 pt-1">
            <summary class="cursor-pointer text-sky-300">
              ${translateText("economy.naval_status")}
            </summary>
            ${navalSectors.length > 0
              ? html`<div class="mt-1">
                  <p class="text-[10px] text-gray-400">
                    ${translateText("economy.naval_sectors")}
                  </p>
                  ${navalSectors.map(
                    (sector) =>
                      html`<div class="flex justify-between gap-2 text-[11px]">
                        <span
                          >${sector.x},${sector.y} · ${sector.ports} ⚓</span
                        >
                        <span>
                          <span class="text-emerald-300"
                            >${sector.friendly}+</span
                          >
                          /
                          <span class="text-red-300">${sector.hostile}−</span>
                        </span>
                      </div>`,
                  )}
                </div>`
              : null}
            ${tradeRoutes.length > 0
              ? html`<div class="mt-1 border-t border-white/5 pt-1">
                  <p class="text-[10px] text-gray-400">
                    ${translateText("economy.trade_routes")}
                  </p>
                  ${tradeRoutes.map(
                    ({ ship, port, x, y }) =>
                      html`<div
                        class="flex justify-between gap-2 text-[11px]"
                        title=${`${ship.owner().displayName()} → ${port.owner().displayName()}`}
                      >
                        <span class="truncate"
                          >${ship.owner().displayName()} →
                          ${port.owner().displayName()}</span
                        >
                        <span class="shrink-0 text-gray-300">
                          ${x},${y} · ${translateText("economy.in_transit")}
                        </span>
                      </div>`,
                  )}
                </div>`
              : null}
          </details>`
        : null}
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
