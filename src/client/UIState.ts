import { PlayerBuildableUnitType } from "../core/game/Game";
import { BuildCategoryId } from "./hud/BuildCategories";

export interface UIState {
  attackRatio: number;
  /** Fraction of the ratio-derived tank force committed to each land attack. */
  tankCommitmentRatio?: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  buildCategory?: BuildCategoryId;
  trenchPlacementMode?: boolean;
}
