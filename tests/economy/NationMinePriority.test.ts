import { ECONOMY } from "../../src/core/configuration/StrategyConfig";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { NationStructureBehavior } from "../../src/core/execution/nation/NationStructureBehavior";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import {
  NaturalResource,
  STOCK_RESOURCES,
} from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic mine priority", () => {
  let game: Game;
  let player: Player;
  let behavior: NationStructureBehavior;

  beforeEach(async () => {
    const info = new PlayerInfo("miner", PlayerType.Human, null, "miner_id");
    game = await setup(
      "big_plains",
      {
        strategicEconomy: true,
        infiniteGold: true,
        instantBuild: true,
      },
      [info],
    );
    player = game.player(info.id);
    behavior = new NationStructureBehavior(new PseudoRandom(0), game, player);

    for (const resource of STOCK_RESOURCES) {
      player.removeResource(resource, player.resourceAmount(resource));
    }
    for (const [resource, target] of Object.entries(ECONOMY.mineStockTargets)) {
      player.addResource(resource as NaturalResource, target);
    }
  });

  function makeScarce(resource: NaturalResource): void {
    player.removeResource(resource, player.resourceAmount(resource));
  }

  function ownedDeposit(resource: NaturalResource): number {
    const node = game
      .resourceNodes()
      .find((candidate) => candidate.resource === resource);
    if (node === undefined)
      throw new Error(`No ${resource} deposit in fixture`);
    const tile = game.ref(node.x, node.y);
    player.conquer(tile);
    return tile;
  }

  function planMine(): boolean {
    return (behavior as any).tryBuildResourceMine();
  }

  it("builds a mine on an owned deposit for the most scarce raw resource", () => {
    makeScarce(NaturalResource.Oil);
    makeScarce(NaturalResource.Iron);
    player.addResource(NaturalResource.Oil, 12);
    const oilTile = ownedDeposit(NaturalResource.Oil);
    const ironTile = ownedDeposit(NaturalResource.Iron);
    const addExecution = vi.spyOn(game, "addExecution");

    expect(planMine()).toBe(true);
    expect(addExecution).toHaveBeenCalledTimes(1);
    const execution = addExecution.mock.calls[0][0] as ConstructionExecution;
    expect(execution).toBeInstanceOf(ConstructionExecution);
    expect((execution as any).constructionType).toBe(UnitType.Mine);
    expect((execution as any).tile).toBe(ironTile);
    expect((execution as any).tile).not.toBe(oilTile);
  });

  it("does not place a mine without owning a deposit", () => {
    makeScarce(NaturalResource.Iron);

    expect(planMine()).toBe(false);
  });

  it("indexes resource deposits once per game across repeated decisions", () => {
    makeScarce(NaturalResource.Iron);
    const resourceNodes = vi.spyOn(game, "resourceNodes");

    expect(planMine()).toBe(false);
    expect(planMine()).toBe(false);
    expect(resourceNodes).toHaveBeenCalledTimes(1);
  });

  it("does not queue duplicate mines for the same resource", () => {
    makeScarce(NaturalResource.Iron);
    ownedDeposit(NaturalResource.Iron);
    const addExecution = vi.spyOn(game, "addExecution");

    expect(planMine()).toBe(true);
    expect(planMine()).toBe(false);
    expect(addExecution).toHaveBeenCalledTimes(1);
  });

  it("does not mine a resource whose stock meets its target", () => {
    ownedDeposit(NaturalResource.Iron);

    expect(planMine()).toBe(false);
  });
});
