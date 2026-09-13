import { describe, expect, test } from "vitest";
import { Player, PlayerInfo, PlayerType } from "../src/core/game/Game";
import {
  emptyResourceStock,
  NaturalResource,
} from "../src/core/game/Resources";
import { setup } from "./util/Setup";

describe("authoritative player resource stock", () => {
  test("starts with every natural resource at zero", async () => {
    const game = await setup("ocean_and_land");
    const player = game.addPlayer(
      new PlayerInfo("miner", PlayerType.Human, null, "miner"),
    );

    expect(player.resourceStock()).toEqual(emptyResourceStock());
  });

  test("adds and removes integer units without going below zero", async () => {
    const game = await setup("ocean_and_land");
    const player = game.addPlayer(
      new PlayerInfo("miner", PlayerType.Human, null, "miner"),
    );

    player.addResource(NaturalResource.Copper, 12.8);
    expect(player.resourceAmount(NaturalResource.Copper)).toBe(12);
    expect(player.removeResource(NaturalResource.Copper, 5.9)).toBe(5);
    expect(player.resourceAmount(NaturalResource.Copper)).toBe(7);
    expect(player.removeResource(NaturalResource.Copper, 100)).toBe(7);
    expect(player.resourceAmount(NaturalResource.Copper)).toBe(0);
  });

  test("carries changed stock in the PlayerUpdate diff", async () => {
    const game = await setup("ocean_and_land");
    const player = game.addPlayer(
      new PlayerInfo("miner", PlayerType.Human, null, "miner"),
    );

    const firstUpdate = player.toUpdate();
    expect(firstUpdate?.resources).toEqual(emptyResourceStock());

    expect(player.toUpdate()).toBeNull();

    player.addResource(NaturalResource.Gold, 24);
    const diff = player.toUpdate();
    expect(diff?.resources?.[NaturalResource.Gold]).toBe(24);
    expect(diff?.resources).toEqual({
      ...emptyResourceStock(),
      [NaturalResource.Gold]: 24,
    });
    expect(structuredClone(diff)).toEqual(diff);
  });

  test("replaying the same stock operations is deterministic", async () => {
    const run = async (): Promise<
      Readonly<Record<NaturalResource, number>>
    > => {
      const game = await setup("ocean_and_land");
      const player: Player = game.addPlayer(
        new PlayerInfo("miner", PlayerType.Human, null, "miner"),
      );
      player.addResource(NaturalResource.Iron, 40);
      player.addResource(NaturalResource.Oil, 9);
      player.removeResource(NaturalResource.Iron, 13);
      return player.resourceStock();
    };

    expect(await run()).toEqual(await run());
  });
});
