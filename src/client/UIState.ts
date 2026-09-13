import { PlayerBuildableUnitType } from "../core/game/Game";
import { BuildCategoryId } from "./hud/BuildCategories";

export interface UIState {
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  buildCategory?: BuildCategoryId;
}
