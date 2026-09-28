import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { MineExecution } from "../../src/core/execution/MineExecution";
import { UpgradeStructureExecution } from "../../src/core/execution/UpgradeStructureExecution";
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
    const mine = player.units(UnitType.Mine)[0];
    const produced =
      mine.toUpdate().production?.resourceOutputs?.[node.resource];
    expect(produced).toBeGreaterThan(0);
    expect(player.resourceAmount(node.resource)).toBe(produced);
    expect(
      mine.toUpdate().production?.depositConcentrations?.[node.resource],
    ).toBe(node.concentration);
  });

  test("allows a mine anywhere inside a resource area, away from its marker", () => {
    const markerTiles = new Set(
      game.resourceNodes().map((node) => game.ref(node.x, node.y)),
    );
    let site: number | undefined;
    for (let y = 0; y < game.height() && site === undefined; y++) {
      for (let x = 0; x < game.width(); x++) {
        const tile = game.ref(x, y);
        if (
          !markerTiles.has(tile) &&
          game
            .resourceDepositsAt(tile)
            .some(
              (deposit) => game.resourceRemaining(tile, deposit.resource) > 0,
            )
        ) {
          site = tile;
          break;
        }
      }
    }
    expect(site).toBeDefined();
    player.conquer(site!);
    expect(player.canBuild(UnitType.Mine, site!)).toBe(site);
    game.addExecution(new ConstructionExecution(player, UnitType.Mine, site!));
    for (let i = 0; i < 11; i++) game.executeNextTick();

    const mine = player.units(UnitType.Mine)[0];
    expect(mine.tile()).toBe(site);
    expect(mine.toUpdate().production?.produced).toBeGreaterThan(0);
  });

  test("one mine extracts every resource in an overlapping noise area", () => {
    let site: number | undefined;
    for (let y = 0; y < game.height() && site === undefined; y++) {
      for (let x = 0; x < game.width(); x++) {
        const tile = game.ref(x, y);
        if (game.resourceDepositsAt(tile).length > 1) {
          site = tile;
          break;
        }
      }
    }

    expect(site).toBeDefined();
    const deposits = game.resourceDepositsAt(site!);
    player.conquer(site!);
    expect(player.canBuild(UnitType.Mine, site!)).toBe(site);
    game.addExecution(new ConstructionExecution(player, UnitType.Mine, site!));
    for (let i = 0; i < 11; i++) game.executeNextTick();

    const mine = player.units(UnitType.Mine)[0];
    const production = mine.toUpdate().production!;
    expect(Object.keys(production.resourceOutputs ?? {}).sort()).toEqual(
      deposits.map((deposit) => deposit.resource).sort(),
    );
    for (const deposit of deposits) {
      expect(production.resourceOutputs?.[deposit.resource]).toBeGreaterThan(0);
      expect(production.depositConcentrations?.[deposit.resource]).toBe(
        deposit.concentration,
      );
      expect(player.resourceAmount(deposit.resource)).toBe(
        production.resourceOutputs?.[deposit.resource],
      );
    }
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
    for (let i = 0; i < 5000; i++) execution.tick(i * 10);

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

  test("upgrading a mine increases extraction and duplicate ticks are ignored", () => {
    const node = game.resourceNodes()[0];
    const tile = game.ref(node.x, node.y);
    player.conquer(tile);
    game.addExecution(new ConstructionExecution(player, UnitType.Mine, tile));
    for (let i = 0; i < 11; i++) game.executeNextTick();

    const mine = player.units(UnitType.Mine)[0];
    game.endSpawnPhase();
    game.addExecution(new UpgradeStructureExecution(player, mine.id()));
    game.executeNextTick();
    expect(mine.level()).toBe(2);

    const before = player.resourceAmount(node.resource);
    const execution = new MineExecution(mine);
    execution.init(game);
    execution.tick(10);
    execution.tick(10);

    const concentration = node.concentration ?? node.richness * 25;
    expect(player.resourceAmount(node.resource) - before).toBe(
      Math.floor((concentration * 8) / 25) -
        Math.floor((concentration * 4) / 25),
    );
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
