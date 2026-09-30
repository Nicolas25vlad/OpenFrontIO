import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import {
  SelectBuildCategoryEvent,
  ToggleStructureEvent,
} from "../../InputHandler";
import { Platform } from "../../Platform";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
import { BUILD_CATEGORIES, BuildCategoryId } from "../BuildCategories";
import { goldCoinIcon } from "../HotbarIcons";
import { TutorialHighlight, TutorialHighlightEvent } from "../Tutorial";
import { flattenedBuildTable } from "./BuildMenu";

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, string> = {};
  private allDisabled = false;
  private _hoveredUnit: PlayerBuildableUnitType | null = null;
  private tutorialHighlight: PlayerBuildableUnitType | null = null;

  @state()
  private selectedCategory: BuildCategoryId = "civil";

  createRenderRoot() {
    return this;
  }

  init() {
    const config = this.game.config();
    const userSettings = new UserSettings();

    this.keybinds = userSettings.keybinds(Platform.isMac);
    if (config.strategicEconomy())
      this.uiState.buildCategory = this.selectedCategory;

    this.eventBus.on(SelectBuildCategoryEvent, (event) => {
      this.selectedCategory = event.category;
      this.uiState.buildCategory = event.category;
      this.requestUpdate();
    });
    this.allDisabled = BuildMenus.types.every((u) => config.isUnitDisabled(u));

    const highlightUnits: Partial<
      Record<TutorialHighlight, PlayerBuildableUnitType>
    > = {
      city: UnitType.City,
      port: UnitType.Port,
      defense_post: UnitType.DefensePost,
      factory: UnitType.Factory,
      warship: UnitType.Warship,
      silo: UnitType.MissileSilo,
      atom: UnitType.AtomBomb,
      hydrogen: UnitType.HydrogenBomb,
      mirv: UnitType.MIRV,
      sam: UnitType.SAMLauncher,
    };
    this.eventBus.on(TutorialHighlightEvent, (e) => {
      this.tutorialHighlight = (e.target && highlightUnits[e.target]) ?? null;
      if (this.tutorialHighlight) {
        const category = BUILD_CATEGORIES.find((c) =>
          c.unitTypes.includes(this.tutorialHighlight!),
        );
        if (category) this.selectedCategory = category.id;
      }
      this.requestUpdate();
    });
    this.requestUpdate();
  }

  private cost(item: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item) {
        return bu.cost;
      }
    }
    return 0n;
  }

  private canBuild(item: UnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    if (
      this.playerBuildables?.find((bu) => bu.type === item)?.resourceLimit === 0
    )
      return false;
    const player = this.game?.myPlayer();
    switch (item) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.MissileSilo).length ?? 0) > 0
        );
      case UnitType.Warship:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.Port).length ?? 0) > 0
        );
      default:
        return this.cost(item) <= (player?.gold() ?? 0n);
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
      this.requestUpdate();
    });
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    if (this.allDisabled) {
      return null;
    }

    const category = BUILD_CATEGORIES.find(
      (entry) => entry.id === this.selectedCategory,
    )!;
    const legacyKeys: Partial<Record<UnitType, string>> = {
      [UnitType.City]: "buildCity",
      [UnitType.Factory]: "buildFactory",
      [UnitType.Port]: "buildPort",
      [UnitType.DefensePost]: "buildDefensePost",
      [UnitType.MissileSilo]: "buildMissileSilo",
      [UnitType.SAMLauncher]: "buildSamLauncher",
      [UnitType.Warship]: "buildWarship",
      [UnitType.AtomBomb]: "buildAtomBomb",
      [UnitType.HydrogenBomb]: "buildHydrogenBomb",
      [UnitType.MIRV]: "buildMIRV",
    };

    return html`
      <div class="border-t border-white/10 p-0.5 w-full">
        <div class="flex justify-center gap-0.5 mb-0.5">
          ${category.unitTypes
            .filter((type) => !this.game.config().isUnitDisabled(type))
            .map((unitType, index) => {
              const item = flattenedBuildTable.find(
                (entry) => entry.unitType === unitType,
              )!;
              return this.renderUnitItem(
                item.icon,
                item.countable ? myPlayer.totalUnitLevels(unitType) : null,
                unitType,
                item.key!.replace("unit_type.", ""),
                this.uiState.buildCategory
                  ? `Digit${index + 1}`
                  : (this.keybinds[legacyKeys[unitType] ?? ""] ?? ""),
              );
            })}
        </div>
        <div class="flex justify-center gap-0.5">
          ${BUILD_CATEGORIES.map((entry) => {
            const enabled = entry.unitTypes.some(
              (unitType) => !this.game.config().isUnitDisabled(unitType),
            );
            return html`
              <button
                class="border rounded-sm px-1.5 py-0.5 text-white text-[10px] flex items-center gap-1 ${this
                  .selectedCategory === entry.id
                  ? "bg-slate-400/20 border-slate-300"
                  : "border-slate-500 hover:bg-gray-800"} ${enabled
                  ? ""
                  : "opacity-40"}"
                ?disabled=${!enabled}
                title=${translateText(entry.translationKey)}
                @click=${() => {
                  if (enabled)
                    this.eventBus.emit(new SelectBuildCategoryEvent(entry.id));
                }}
              >
                <span
                  >${this.displayHotkey(
                    this.keybinds[entry.keybind] ?? "",
                  )}</span
                >
                <img src=${entry.icon} alt="" class="size-4" />
                <span>${translateText(entry.translationKey)}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
  ) {
    if (this.game.config().isUnitDisabled(unitType)) {
      return html``;
    }
    const selected = this.uiState.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = this.displayHotkey(hotkey);

    return html`
      <div
        class="flex flex-col items-center relative"
        @mouseenter=${() => {
          this._hoveredUnit = unitType;
          this.requestUpdate();
        }}
        @mouseleave=${() => {
          this._hoveredUnit = null;
          this.requestUpdate();
        }}
      >
        ${hovered
          ? html`
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-gray-200 text-center w-max text-xs bg-gray-800/90 backdrop-blur-xs rounded-sm p-1 z-[100] shadow-lg pointer-events-none"
              >
                <div class="font-bold text-sm mb-1">
                  ${translateText(
                    "unit_type." + structureKey,
                  )}${` [${displayHotkey}]`}
                </div>
                <div class="p-2">
                  ${translateText("build_menu.desc." + structureKey)}
                </div>
                ${unitType === UnitType.Warship
                  ? html`<div
                      class="mt-1 px-2 py-1 text-[10px] text-cyan-300 border-t border-white/10"
                    >
                      ⇧ ${translateText("build_menu.warship_shift_hint")}
                    </div>`
                  : null}
                <div class="flex items-center justify-center gap-1">
                  <img src=${goldCoinIcon} width="13" height="13" />
                  <span class="text-yellow-300"
                    >${renderNumber(this.cost(unitType))}</span
                  >
                </div>
                ${Object.entries(this.game.config().resourceCost(unitType)).map(
                  ([resource, amount]) => html`
                    <div class="text-xs text-amber-200">
                      ${translateText(`resource.${resource}`)}: ${amount}
                    </div>
                  `,
                )}
              </div>
            `
          : null}
        <button
          type="button"
          aria-label=${translateText("unit_type." + structureKey)}
          aria-pressed=${selected}
          aria-disabled=${!this.canBuild(unitType)}
          @focus=${() => {
            this._hoveredUnit = unitType;
            this.requestUpdate();
          }}
          @blur=${() => {
            this._hoveredUnit = null;
            this.requestUpdate();
          }}
          class="${this.canBuild(unitType)
            ? ""
            : "opacity-40"} border border-slate-500 rounded-sm px-0.5 pb-0.5 flex items-center gap-0.5 cursor-pointer
             ${selected ? "hover:bg-gray-400/10" : "hover:bg-gray-800"}
             rounded-sm text-white ${selected ? "bg-slate-400/20" : ""}
             ${this.tutorialHighlight === unitType ? "tutorial-highlight" : ""}"
          @click=${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}
          @mouseenter=${() => {
            switch (unitType) {
              case UnitType.AtomBomb:
              case UnitType.HydrogenBomb:
                this.eventBus?.emit(
                  new ToggleStructureEvent([
                    UnitType.MissileSilo,
                    UnitType.SAMLauncher,
                  ]),
                );
                break;
              case UnitType.Warship:
                this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
                break;
              default:
                this.eventBus?.emit(new ToggleStructureEvent([unitType]));
            }
          }}
          @mouseleave=${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}
        >
          ${html`<div class="ml-0.5 text-[10px] relative -top-1 text-gray-400">
            ${displayHotkey}
          </div>`}
          <div class="flex items-center gap-0.5 pt-0.5">
            <img src=${icon} alt=${structureKey} class="align-middle size-5" />
            ${number !== null
              ? html`<span class="text-xs">${renderNumber(number)}</span>`
              : null}
          </div>
        </button>
      </div>
    `;
  }

  private displayHotkey(hotkey: string): string {
    return hotkey
      .replace("Shift+", "⇧ ")
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();
  }
}
