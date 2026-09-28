import { describe, expect, it, vi } from "vitest";
import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { NationEmojiBehavior } from "../../src/core/execution/nation/NationEmojiBehavior";
import { NationWarshipBehavior } from "../../src/core/execution/nation/NationWarshipBehavior";
import {
  Difficulty,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { ProcessedResource } from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

async function setupBlockade(
  strategicEconomy = true,
  giveNationWarshipInputs = true,
) {
  const game = await setup(
    "half_land_half_ocean",
    {
      difficulty: Difficulty.Hard,
      instantBuild: true,
      strategicEconomy,
    },
    [
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
      new PlayerInfo("blockader", PlayerType.Human, null, "blockader_id"),
    ],
  );
  const nation = game.player("nation_id");
  const blockader = game.player("blockader_id");
  const portTile = game.ref(7, 10);
  nation.conquer(portTile);
  nation.addGold(10_000_000n);
  blockader.addGold(10_000_000n);
  blockader.addResource(ProcessedResource.Steel, 100);
  blockader.addResource(ProcessedResource.Fuel, 50);
  if (strategicEconomy) {
    nation.addResource(ProcessedResource.Steel, 15);
  }
  const portSpawn = nation.canBuild(UnitType.Port, portTile);
  if (portSpawn === false) throw new Error("Unable to build test port");
  nation.buildUnit(UnitType.Port, portSpawn, {});
  if (strategicEconomy && giveNationWarshipInputs) {
    nation.addResource(ProcessedResource.Steel, 20);
    nation.addResource(ProcessedResource.Fuel, 10);
  } else if (strategicEconomy) {
    nation.removeResource(
      ProcessedResource.Steel,
      nation.resourceAmount(ProcessedResource.Steel),
    );
    nation.removeResource(
      ProcessedResource.Fuel,
      nation.resourceAmount(ProcessedResource.Fuel),
    );
  }

  const shipTiles = [...game.circleSearch(portTile, 8)].filter((tile) =>
    game.map().isWater(tile),
  );
  if (shipTiles.length < 2) throw new Error("Unable to find test water tiles");
  const blockadingShips = shipTiles
    .slice(0, 2)
    .map((tile) =>
      blockader.buildUnit(UnitType.Warship, tile, { patrolTile: tile }),
    );
  const random = new PseudoRandom(1);
  const emojiBehavior = new NationEmojiBehavior(random, game, nation);
  const behavior = new NationWarshipBehavior(
    random,
    game,
    nation,
    emojiBehavior,
  );
  return { game, nation, blockader, blockadingShips, behavior, random };
}

describe("nation response to naval blockades", () => {
  it("builds a counter-warship for a blocked port in strategic economy", async () => {
    const { game, behavior } = await setupBlockade();
    const addExecution = vi.spyOn(game, "addExecution");

    behavior.counterWarshipInfestation();
    behavior.counterWarshipInfestation();

    expect(
      addExecution.mock.calls
        .flat()
        .filter((execution) => execution instanceof ConstructionExecution),
    ).toHaveLength(1);
  });

  it("keeps the blockade response disabled in legacy economy", async () => {
    const { game, behavior } = await setupBlockade(false);
    const addExecution = vi.spyOn(game, "addExecution");

    behavior.counterWarshipInfestation();

    expect(addExecution).not.toHaveBeenCalled();
  });

  it("does not queue a counter-warship without strategic inputs", async () => {
    const { game, blockader, behavior, random } = await setupBlockade(
      true,
      false,
    );
    const addExecution = vi.spyOn(game, "addExecution");

    expect(() => behavior.counterWarshipInfestation()).not.toThrow();
    vi.spyOn(random, "chance").mockReturnValue(true);
    expect(behavior.maybeSpawnWarship()).toBe(false);
    vi.spyOn(random, "nextInt").mockReturnValue(0);
    (behavior as any).maybeRetaliateWithWarship(
      game.ref(8, 4),
      blockader,
      "trade",
    );
    expect(
      addExecution.mock.calls
        .flat()
        .some((execution) => execution instanceof ConstructionExecution),
    ).toBe(false);
  });
});
