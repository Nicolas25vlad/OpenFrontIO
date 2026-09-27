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
  ProcessedResource,
} from "../../src/core/game/Resources";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("nation strategic nuclear priority", () => {
  let game: Game;
  let player: Player;
  let behavior: NationStructureBehavior;

  beforeEach(async () => {
    const info = new PlayerInfo(
      "nuclear",
      PlayerType.Human,
      null,
      "nuclear_id",
    );
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
    for (let x = 30; x <= 90; x++) {
      for (let y = 30; y <= 90; y++) {
        player.conquer(game.ref(x, y));
      }
    }
    player.addResource(ProcessedResource.Steel, 300);
    player.addResource(ProcessedResource.Circuits, 100);
    player.addResource(NaturalResource.Uranium, 3);
    player.buildUnit(UnitType.MissileSilo, game.ref(50, 50), {});
    behavior = new NationStructureBehavior(new PseudoRandom(0), game, player);
  });

  it("builds a single plant when an enabled weapon needs enriched uranium", () => {
    const addExecution = vi.spyOn(game, "addExecution");

    expect((behavior as any).tryBuildNuclearPlant()).toBe(true);
    expect((behavior as any).tryBuildNuclearPlant()).toBe(false);
    expect(addExecution).toHaveBeenCalledTimes(1);
    const execution = addExecution.mock.calls[0][0] as ConstructionExecution;
    expect(execution).toBeInstanceOf(ConstructionExecution);
    expect((execution as any).constructionType).toBe(UnitType.NuclearPlant);
  });

  it("does not build a plant without immediate production inputs", () => {
    player.removeResource(
      ProcessedResource.Fuel,
      player.resourceAmount(ProcessedResource.Fuel),
    );

    expect((behavior as any).tryBuildNuclearPlant()).toBe(false);
  });

  it("does not add plants after the configured enriched uranium reserve is met", () => {
    player.addResource(ProcessedResource.EnrichedUranium, 60);

    expect((behavior as any).tryBuildNuclearPlant()).toBe(false);
  });
});
