import { PlayerBuildableUnitType, UnitType } from "../../core/game/Game";
import {
  atomBombIcon,
  cityIcon,
  defensePostIcon,
  factoryIcon,
} from "./HotbarIcons";

export type BuildCategoryId = "civil" | "industry" | "military" | "nuclear";

export interface BuildCategory {
  id: BuildCategoryId;
  translationKey: string;
  icon: string;
  keybind: string;
  unitTypes: readonly PlayerBuildableUnitType[];
}

/** Data source for the category bar; adding a category does not change its renderer. */
export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  {
    id: "civil",
    translationKey: "build_category.civil",
    icon: cityIcon,
    keybind: "buildCategoryCivil",
    unitTypes: [UnitType.City, UnitType.Farm, UnitType.Infrastructure],
  },
  {
    id: "industry",
    translationKey: "build_category.industry",
    icon: factoryIcon,
    keybind: "buildCategoryIndustry",
    unitTypes: [
      UnitType.Factory,
      UnitType.Mine,
      UnitType.Port,
      UnitType.VehicleFactory,
    ],
  },
  {
    id: "military",
    translationKey: "build_category.military",
    icon: defensePostIcon,
    keybind: "buildCategoryMilitary",
    unitTypes: [UnitType.DefensePost, UnitType.Warship],
  },
  {
    id: "nuclear",
    translationKey: "build_category.nuclear",
    icon: atomBombIcon,
    keybind: "buildCategoryNuclear",
    unitTypes: [
      UnitType.NuclearPlant,
      UnitType.SAMLauncher,
      UnitType.MissileSilo,
      UnitType.AtomBomb,
      UnitType.HydrogenBomb,
      UnitType.MIRV,
    ],
  },
];

export function buildCategoryFor(
  unitType: PlayerBuildableUnitType,
): BuildCategory | undefined {
  return BUILD_CATEGORIES.find((category) =>
    category.unitTypes.includes(unitType),
  );
}
