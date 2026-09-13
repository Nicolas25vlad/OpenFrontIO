import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { PlayerInfo, PlayerType, UnitType } from "../../src/core/game/Game";
import {
  ProcessedResource,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

test.each([UnitType.AtomBomb, UnitType.HydrogenBomb, UnitType.MIRV])(
  "%s spends materials once, takes time, and is cancelled when its silo is captured",
  async (type) => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("p", PlayerType.Human, null, "p"),
        new PlayerInfo("enemy", PlayerType.Human, null, "enemy"),
      ],
    );
    const p = game.player("p");
    const enemy = game.player("enemy");
    const home = game.ref(10, 10);
    const target = game.ref(150, 150);
    p.conquer(home);
    enemy.conquer(target);
    for (const resource of STOCK_RESOURCES) p.addResource(resource, 1000);
    game.addExecution(new ConstructionExecution(p, UnitType.MissileSilo, home));
    for (let i = 0; i < 3; i++) game.executeNextTick();
    const before = p.resourceAmount(ProcessedResource.EnrichedUranium);
    game.addExecution(new ConstructionExecution(p, type, target));
    for (let i = 0; i < 10; i++) game.executeNextTick();
    const missile = p.units(type)[0];
    const silo = p.units(UnitType.MissileSilo)[0];
    expect(missile).toBeDefined();
    expect(missile.tile()).toBe(home);
    expect(silo.isInCooldown()).toBe(true);
    expect(p.resourceAmount(ProcessedResource.EnrichedUranium)).toBe(
      before -
        game.config().resourceCost(type)[ProcessedResource.EnrichedUranium]!,
    );
    const paid = { ...p.resourceStock() };
    game.addExecution(new ConstructionExecution(p, type, target));
    for (let i = 0; i < 10; i++) game.executeNextTick();
    expect(p.units(type)).toHaveLength(1);
    expect(p.resourceStock()).toEqual(paid);
    enemy.captureUnit(silo);
    game.executeNextTick();
    expect(missile.isActive()).toBe(false);
    expect(p.resourceStock()).toEqual(paid);
  },
);
