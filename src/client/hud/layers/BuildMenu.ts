import { css, html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { translateText } from "../../../client/Utils";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Cell,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import { TileRef } from "../../../core/game/GameMap";
import { ProcessedResource } from "../../../core/game/Resources";
import { Controller } from "../../Controller";
import {
  CloseViewEvent,
  MouseDownEvent,
  MouseMoveEvent,
  MouseUpEvent,
  ShowBuildMenuEvent,
  ShowEmojiMenuEvent,
} from "../../InputHandler";
import { TransformHandler } from "../../TransformHandler";
import {
  BuildTrenchIntentEvent,
  BuildUnitIntentEvent,
  SendUpgradeStructureIntentEvent,
  StartTrenchPlacementEvent,
} from "../../Transport";
import { UIState } from "../../UIState";
import { renderNumber } from "../../Utils";
import { GameView } from "../../view";
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const mineIcon = assetUrl("images/MineIcon.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const mirvIcon = assetUrl("images/MIRVIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const hydrogenBombIcon = assetUrl("images/MushroomCloudIconWhite.svg");
const atomBombIcon = assetUrl("images/NukeIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samlauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const shieldIcon = assetUrl("images/ShieldIconWhite.svg");

export interface BuildItemDisplay {
  unitType: PlayerBuildableUnitType;
  icon: string;
  description?: string;
  key?: string;
  countable?: boolean;
}

export const buildTable: BuildItemDisplay[][] = [
  [
    {
      unitType: UnitType.AtomBomb,
      icon: atomBombIcon,
      description: "build_menu.desc.atom_bomb",
      key: "unit_type.atom_bomb",
      countable: false,
    },
    {
      unitType: UnitType.MIRV,
      icon: mirvIcon,
      description: "build_menu.desc.mirv",
      key: "unit_type.mirv",
      countable: false,
    },
    {
      unitType: UnitType.HydrogenBomb,
      icon: hydrogenBombIcon,
      description: "build_menu.desc.hydrogen_bomb",
      key: "unit_type.hydrogen_bomb",
      countable: false,
    },
    {
      unitType: UnitType.Warship,
      icon: warshipIcon,
      description: "build_menu.desc.warship",
      key: "unit_type.warship",
      countable: true,
    },
    {
      unitType: UnitType.Port,
      icon: portIcon,
      description: "build_menu.desc.port",
      key: "unit_type.port",
      countable: true,
    },
    {
      unitType: UnitType.MissileSilo,
      icon: missileSiloIcon,
      description: "build_menu.desc.missile_silo",
      key: "unit_type.missile_silo",
      countable: true,
    },
    {
      unitType: UnitType.SAMLauncher,
      icon: samlauncherIcon,
      description: "build_menu.desc.sam_launcher",
      key: "unit_type.sam_launcher",
      countable: true,
    },
    {
      unitType: UnitType.DefensePost,
      icon: shieldIcon,
      description: "build_menu.desc.defense_post",
      key: "unit_type.defense_post",
      countable: true,
    },
    {
      unitType: UnitType.City,
      icon: cityIcon,
      description: "build_menu.desc.city",
      key: "unit_type.city",
      countable: true,
    },
    {
      unitType: UnitType.Factory,
      icon: factoryIcon,
      description: "build_menu.desc.factory",
      key: "unit_type.factory",
      countable: true,
    },
    {
      unitType: UnitType.Mine,
      icon: mineIcon,
      description: "build_menu.desc.mine",
      key: "unit_type.mine",
      countable: true,
    },
    ...[
      [UnitType.Farm, "farm", "FarmIcon.svg"],
      [UnitType.Infrastructure, "infrastructure", "InfrastructureIcon.svg"],
      [UnitType.SupplyCenter, "supply_center", "InfrastructureIcon.svg"],
      [UnitType.VehicleFactory, "vehicle_factory", "VehicleFactoryIcon.svg"],
      [UnitType.NuclearPlant, "nuclear_plant", "NuclearPlantIcon.svg"],
    ].map(([unitType, key, icon]) => ({
      unitType: unitType as PlayerBuildableUnitType,
      icon: assetUrl(`images/${icon}`),
      description: `build_menu.desc.${key}`,
      key: `unit_type.${key}`,
      countable: true,
    })),
  ],
];

export const flattenedBuildTable = buildTable.flat();

@customElement("build-menu")
export class BuildMenu extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private clickedTile: TileRef;
  public playerBuildables: BuildableUnit[] | null = null;
  private filteredBuildTable: BuildItemDisplay[][] = buildTable;
  public transformHandler: TransformHandler;
  private trenchPlacementMode = false;

  @state()
  private hoveredTrenchTile: TileRef | null = null;

  init() {
    this.eventBus.on(ShowBuildMenuEvent, (e) => {
      if (!this.game.myPlayer()?.isAlive()) {
        return;
      }
      if (!this._hidden) {
        // Players sometimes hold control while building a unit,
        // so if the menu is already open, ignore the event.
        return;
      }
      const clickedCell = this.transformHandler.screenToWorldCoordinates(
        e.x,
        e.y,
      );
      if (!this.game.isValidCoord(clickedCell.x, clickedCell.y)) {
        return;
      }
      const tile = this.game.ref(clickedCell.x, clickedCell.y);
      this.showMenu(tile);
    });
    this.eventBus.on(StartTrenchPlacementEvent, () => {
      this.trenchPlacementMode = true;
      this.hoveredTrenchTile = null;
      if (this.uiState) this.uiState.trenchPlacementMode = true;
      this.hideMenu();
      this.requestUpdate();
    });
    this.eventBus.on(CloseViewEvent, () => {
      this.cancelTrenchPlacement();
      this.hideMenu();
    });
    this.eventBus.on(ShowEmojiMenuEvent, () => this.hideMenu());
    this.eventBus.on(MouseDownEvent, () => {
      if (!this.trenchPlacementMode) this.hideMenu();
    });
    this.eventBus.on(MouseMoveEvent, (e) => {
      if (!this.trenchPlacementMode) return;
      this.hoveredTrenchTile = this.tileAtScreen(e.x, e.y);
      this.requestUpdate();
    });
    this.eventBus.on(MouseUpEvent, (e) => {
      if (!this.trenchPlacementMode) return;
      const tile = this.tileAtScreen(e.x, e.y);
      if (tile === null || !this.canPlaceTrench(tile)) return;
      this.eventBus.emit(new BuildTrenchIntentEvent(tile));
      this.cancelTrenchPlacement();
    });
  }

  tick() {
    if (!this._hidden) {
      this.refresh();
    }
  }

  static styles = css`
    :host {
      display: block;
    }
    .build-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      background-color: #1e1e1e;
      padding: 15px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 95vw;
      max-height: 95vh;
      overflow-y: auto;
    }
    .build-description {
      font-size: 0.6rem;
    }
    .build-row {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      width: 100%;
    }
    .build-button {
      position: relative;
      width: 120px;
      height: 140px;
      border: 2px solid #444;
      background-color: #2c2c2c;
      color: white;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      margin: 8px;
      padding: 10px;
      gap: 5px;
    }
    .build-button:not(:disabled):hover {
      background-color: #3a3a3a;
      transform: scale(1.05);
      border-color: #666;
    }
    .build-button:not(:disabled):active {
      background-color: #4a4a4a;
      transform: scale(0.95);
    }
    .build-button:disabled {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
      opacity: 0.7;
    }
    .build-button:disabled img {
      opacity: 0.5;
    }
    .build-button:disabled .build-cost {
      color: #ff4444;
    }
    .build-icon {
      font-size: 40px;
      margin-bottom: 5px;
    }
    .build-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 5px;
      text-align: center;
    }
    .build-cost {
      font-size: 14px;
    }
    .hidden {
      display: none !important;
    }
    .build-count-chip {
      position: absolute;
      top: -10px;
      right: -10px;
      background-color: #2c2c2c;
      color: white;
      padding: 2px 10px;
      border-radius: 10000px;
      transition: all 0.3s ease;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-content: center;
      border: 1px solid #444;
    }
    .build-button:not(:disabled):hover > .build-count-chip {
      background-color: #3a3a3a;
      border-color: #666;
    }
    .build-button:not(:disabled):active > .build-count-chip {
      background-color: #4a4a4a;
    }
    .build-button:disabled > .build-count-chip {
      background-color: #1a1a1a;
      border-color: #333;
      cursor: not-allowed;
    }
    .build-count {
      font-weight: bold;
      font-size: 14px;
    }
    .trench-placement-banner {
      position: fixed;
      top: 1rem;
      left: 50%;
      z-index: 10000;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid #a89b74;
      border-radius: 0.5rem;
      background: rgba(24, 24, 20, 0.95);
      color: white;
    }
    .trench-placement-tile {
      position: fixed;
      z-index: 9999;
      width: 12px;
      height: 12px;
      border: 2px solid #e8d7a3;
      border-radius: 2px;
      background: rgba(115, 93, 52, 0.55);
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
      pointer-events: none;
      transform: translate(-50%, -50%);
    }
    .trench-placement-tile.invalid {
      border-color: #e56b6f;
      background: rgba(150, 35, 40, 0.45);
    }

    @media (max-width: 768px) {
      .build-menu {
        padding: 10px;
        max-height: 80vh;
        width: 80vw;
      }
      .build-button {
        width: 140px;
        height: 120px;
        margin: 4px;
        padding: 6px;
        gap: 5px;
      }
      .build-icon {
        font-size: 28px;
      }
      .build-name {
        font-size: 12px;
        margin-bottom: 3px;
      }
      .build-cost {
        font-size: 11px;
      }
      .build-count {
        font-weight: bold;
        font-size: 10px;
      }
      .build-count-chip {
        padding: 1px 5px;
      }
    }

    @media (max-width: 480px) {
      .build-menu {
        padding: 8px;
        max-height: 70vh;
      }
      .build-button {
        width: calc(50% - 6px);
        height: 100px;
        margin: 3px;
        padding: 4px;
        border-width: 1px;
      }
      .build-icon {
        font-size: 24px;
      }
      .build-name {
        font-size: 10px;
        margin-bottom: 2px;
      }
      .build-cost {
        font-size: 9px;
      }
      .build-count {
        font-weight: bold;
        font-size: 8px;
      }
      .build-count-chip {
        padding: 0 3px;
      }
      .build-button img {
        width: 24px;
        height: 24px;
      }
      .build-cost img {
        width: 10px;
        height: 10px;
      }
    }
  `;

  @state()
  private _hidden = true;

  public canBuildOrUpgrade(item: BuildItemDisplay): boolean {
    if (this.game?.myPlayer() === null || this.playerBuildables === null) {
      return false;
    }
    const unit = this.playerBuildables.find((u) => u.type === item.unitType);
    return unit ? unit.canBuild !== false || unit.canUpgrade !== false : false;
  }

  public cost(item: BuildItemDisplay): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item.unitType) {
        return bu.cost;
      }
    }
    return 0n;
  }

  public count(item: BuildItemDisplay): string {
    const player = this.game?.myPlayer();
    if (!player) {
      return "?";
    }

    return player.totalUnitLevels(item.unitType).toString();
  }

  public sendBuildOrUpgrade(buildableUnit: BuildableUnit, tile: TileRef): void {
    if (buildableUnit.canUpgrade !== false) {
      this.eventBus.emit(
        new SendUpgradeStructureIntentEvent(
          buildableUnit.canUpgrade,
          buildableUnit.type,
        ),
      );
    } else if (buildableUnit.canBuild) {
      const rocketDirectionUp =
        buildableUnit.type === UnitType.AtomBomb ||
        buildableUnit.type === UnitType.HydrogenBomb
          ? this.uiState.rocketDirectionUp
          : undefined;
      this.eventBus.emit(
        new BuildUnitIntentEvent(buildableUnit.type, tile, rocketDirectionUp),
      );
    }
    this.hideMenu();
  }

  render() {
    return html`
      ${this.trenchPlacementMode
        ? html`<div class="trench-placement-banner">
            <span>${translateText("build_menu.trench_placement_hint")}</span>
            <button
              class="border border-white/40 rounded px-2 py-1"
              @click=${() => this.cancelTrenchPlacement()}
            >
              ${translateText("build_menu.trench_placement_cancel")}
            </button>
          </div>`
        : ""}
      ${this.trenchPlacementMode && this.hoveredTrenchTile !== null
        ? (() => {
            const screen = this.transformHandler.worldToScreenCoordinates(
              new Cell(
                this.game.x(this.hoveredTrenchTile!),
                this.game.y(this.hoveredTrenchTile!),
              ),
            );
            return html`<div
              class="trench-placement-tile ${this.canPlaceTrench(
                this.hoveredTrenchTile!,
              )
                ? "valid"
                : "invalid"}"
              style="left:${screen.x}px;top:${screen.y}px"
            ></div>`;
          })()
        : ""}
      <div
        class="build-menu ${this._hidden ? "hidden" : ""}"
        @contextmenu=${(e: MouseEvent) => e.preventDefault()}
      >
        ${this.filteredBuildTable.map(
          (row) => html`
            <div class="build-row">
              ${row.map((item) => {
                const buildableUnit = this.playerBuildables?.find(
                  (bu) => bu.type === item.unitType,
                );
                if (buildableUnit === undefined) {
                  return html``;
                }
                const enabled =
                  buildableUnit.canBuild !== false ||
                  buildableUnit.canUpgrade !== false;
                return html`
                  <button
                    class="build-button"
                    @click=${() =>
                      this.sendBuildOrUpgrade(buildableUnit, this.clickedTile)}
                    ?disabled=${!enabled}
                    title=${!enabled
                      ? translateText(
                          buildableUnit.resourceLimit === 0
                            ? "economy.missing"
                            : "build_menu.not_enough_money",
                        )
                      : ""}
                  >
                    <img
                      src=${item.icon}
                      alt="${item.unitType}"
                      width="40"
                      height="40"
                    />
                    <span class="build-name"
                      >${item.key && translateText(item.key)}</span
                    >
                    <span class="build-description"
                      >${item.description &&
                      translateText(item.description)}</span
                    >
                    <span class="build-cost" translate="no">
                      ${renderNumber(
                        this.game && this.game.myPlayer() ? this.cost(item) : 0,
                      )}
                      <img
                        src=${goldCoinIcon}
                        alt="gold"
                        width="12"
                        height="12"
                        class="align-middle"
                      />
                    </span>
                    ${Object.entries(buildableUnit.resourceCost ?? {}).map(
                      ([resource, amount]) => html`
                        <span class="text-xs text-amber-200"
                          >${translateText(`resource.${resource}`)}:
                          ${amount}</span
                        >
                      `,
                    )}
                    ${item.countable
                      ? html`<div class="build-count-chip">
                          <span class="build-count">${this.count(item)}</span>
                        </div>`
                      : ""}
                  </button>
                `;
              })}
            </div>
          `,
        )}
      </div>
    `;
  }

  hideMenu() {
    this._hidden = true;
    this.requestUpdate();
  }

  showMenu(clickedTile: TileRef) {
    this.clickedTile = clickedTile;
    this._hidden = false;
    this.refresh();
  }

  private refresh() {
    this.game
      .myPlayer()
      ?.buildables(this.clickedTile, BuildMenus.types)
      .then((buildables) => {
        this.playerBuildables = buildables;
        this.requestUpdate();
      });

    // remove disabled buildings from the buildtable
    this.filteredBuildTable = this.getBuildableUnits();
  }

  private tileAtScreen(screenX: number, screenY: number): TileRef | null {
    const cell = this.transformHandler.screenToWorldCoordinates(
      screenX,
      screenY,
    );
    return this.game.isValidCoord(cell.x, cell.y)
      ? this.game.ref(cell.x, cell.y)
      : null;
  }

  private canPlaceTrench(tile: TileRef): boolean {
    const player = this.game.myPlayer();
    if (
      !player ||
      !this.game.config().strategicEconomy() ||
      !this.game.isLand(tile) ||
      this.game.isImpassable(tile) ||
      this.game.ownerID(tile) !== player.smallID() ||
      !this.game.isBorder(tile) ||
      this.game.trenchLevel(tile) >= this.game.config().trenchMaxLevel() ||
      player.resourceAmount(ProcessedResource.Steel) <
        (this.game.config().trenchCost()[ProcessedResource.Steel] ?? 0)
    ) {
      return false;
    }
    return true;
  }

  private cancelTrenchPlacement(): void {
    this.trenchPlacementMode = false;
    this.hoveredTrenchTile = null;
    if (this.uiState) this.uiState.trenchPlacementMode = false;
    this.requestUpdate();
  }

  private getBuildableUnits(): BuildItemDisplay[][] {
    return buildTable.map((row) =>
      row.filter((item) => !this.game?.config()?.isUnitDisabled(item.unitType)),
    );
  }

  get isVisible() {
    return !this._hidden;
  }
}
