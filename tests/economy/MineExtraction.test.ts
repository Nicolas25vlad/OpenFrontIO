import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { MineExecution } from "../../src/core/execution/MineExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import {
  NaturalResource,
  ResourceCatalog,
  resourceReserveFor,
} from "../../src/core/game/Resources";
import { setup } from "../util/Setup";

describe("mine extraction", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    const info = new PlayerInfo("miner", PlayerType.Human, null, "miner_id");
    game = await setup(
      "plains",
      {
        strategicEconomy: true,
        infiniteGold: true,
        instantBuild: true,
        infiniteTroops: true,
      },
      [info],
    );
    player = game.player(info.id);
  });

  test("only builds on an owned deposit and extracts deterministically", () => {
    const node = game.resourceNodes()[0];
    const tile = game.ref(node.x, node.y);
    player.conquer(tile);

    expect(player.canBuild(UnitType.Mine, tile)).toBe(tile);
    game.addExecution(new ConstructionExecution(player, UnitType.Mine, tile));
    for (let i = 0; i < 11; i++) game.executeNextTick();

    expect(player.units(UnitType.Mine)).toHaveLength(1);
    expect(player.resourceAmount(node.resource)).toBe(node.richness * 2);
  });

  test("depletion persists through demolition and rebuilding", () => {
    const node = game.resourceNodes()[0];
    const tile = game.ref(node.x, node.y);
    player.conquer(tile);
    const reserve = resourceReserveFor(node.richness);

    game.addExecution(new ConstructionExecution(player, UnitType.Mine, tile));
    game.executeNextTick();
    game.executeNextTick();
    const mine = player.units(UnitType.Mine)[0];
    const execution = new MineExecution(mine);
    execution.init(game);
    for (let i = 0; i < 1600; i++) execution.tick(i * 10);

    expect(player.resourceAmount(node.resource)).toBe(reserve);
    expect(game.extractResource(tile, 1)).toBe(0);
    mine.delete(false);
    expect(game.resourceRemaining(tile, node.resource)).toBe(0);
    const anyRemaining = game
      .resourceDepositsAt(tile)
      .some((n) => game.resourceRemaining(tile, n.resource) > 0);
    expect(player.canBuild(UnitType.Mine, tile)).toBe(
      anyRemaining ? tile : false,
    );
    game.addExecution(new ConstructionExecution(player, UnitType.Mine, tile));
    game.executeNextTick();
    game.executeNextTick();
    expect(player.units(UnitType.Mine)).toHaveLength(anyRemaining ? 1 : 0);
    expect(player.resourceAmount(node.resource)).toBe(reserve);
  });
});

test("overlapping reserves stay independent and invalid terrain cannot be mined", () => {
  let land = true;
  let impassable = false;
  const map = {
    width: () => 100,
    height: () => 100,
    ref: (x: number, y: number) => y * 100 + x,
    x: (tile: number) => tile % 100,
    y: (tile: number) => Math.floor(tile / 100),
    isLand: () => land,
    isImpassable: () => impassable,
  };
  const catalog = new ResourceCatalog(map, "overlap", [
    { x: 50, y: 50, resource: NaturalResource.Oil, richness: 1 },
    { x: 50, y: 50, resource: NaturalResource.Gold, richness: 2 },
  ]);
  const tile = map.ref(50, 50);
  expect(catalog.extract(tile, 10, NaturalResource.Oil)).toBe(10);
  expect(catalog.remaining(tile, NaturalResource.Gold)).toBe(
    resourceReserveFor(2),
  );
  expect(catalog.extract(tile, 20, NaturalResource.Gold)).toBe(20);
  for (const amount of [NaN, Infinity, -1, 0])
    expect(catalog.extract(tile, amount)).toBe(0);
  impassable = true;
  expect(catalog.extract(tile, 10, NaturalResource.Gold)).toBe(0);
  impassable = false;
  land = false;
  expect(catalog.extract(tile, 10, NaturalResource.Oil)).toBe(0);
});
