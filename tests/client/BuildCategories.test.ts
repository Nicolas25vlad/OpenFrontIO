import { describe, expect, test } from "vitest";
import {
  BUILD_CATEGORIES,
  buildCategoryFor,
} from "../../src/client/hud/BuildCategories";
import { BuildMenus, UnitType } from "../../src/core/game/Game";

describe("build categories", () => {
  test("cover every current player construction exactly once", () => {
    const units = BUILD_CATEGORIES.flatMap((category) => category.unitTypes);

    expect(new Set(units).size).toBe(units.length);
    expect(new Set(units)).toEqual(new Set(BuildMenus.types));
    expect(units).toEqual(
      expect.arrayContaining([
        UnitType.City,
        UnitType.Factory,
        UnitType.Port,
        UnitType.DefensePost,
        UnitType.MissileSilo,
        UnitType.SAMLauncher,
        UnitType.Warship,
        UnitType.AtomBomb,
        UnitType.HydrogenBomb,
        UnitType.MIRV,
      ]),
    );
  });

  test("resolves a unit to its data category", () => {
    expect(buildCategoryFor(UnitType.City)?.id).toBe("civil");
    expect(buildCategoryFor(UnitType.Factory)?.id).toBe("industry");
    expect(buildCategoryFor(UnitType.DefensePost)?.id).toBe("military");
    expect(buildCategoryFor(UnitType.MissileSilo)?.id).toBe("nuclear");
  });
});
