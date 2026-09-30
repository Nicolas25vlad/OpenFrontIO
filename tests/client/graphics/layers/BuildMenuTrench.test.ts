import { expect, test } from "vitest";
import { buildTable } from "../../../../src/client/hud/layers/BuildMenu";
import { UnitType } from "../../../../src/core/game/Game";

test("trenches use the regular structure build menu entry", () => {
  const trench = buildTable
    .flat()
    .find((item) => item.unitType === UnitType.Trench);

  expect(trench).toMatchObject({
    unitType: UnitType.Trench,
    icon: expect.stringContaining("TrenchIcon.svg"),
    key: "unit_type.trench",
    countable: true,
  });
});
