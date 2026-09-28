import { STRATEGIC_COMBAT } from "../src/core/configuration/StrategyConfig";
import { ConstructionExecution } from "../src/core/execution/ConstructionExecution";
import { Executor } from "../src/core/execution/ExecutionManager";
import { MoveTankExecution } from "../src/core/execution/MoveTankExecution";
import { Game, PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { GameUpdateType, HashUpdate } from "../src/core/game/GameUpdates";
import { setup } from "./util/Setup";

async function tankGame(strategicEconomy = true): Promise<Game> {
  return setup(
    "big_plains",
    { strategicEconomy, infiniteGold: true, instantBuild: true },
    [new PlayerInfo("army", PlayerType.Human, "army-client", "army")],
  );
}

async function deterministicAssaultResult(): Promise<number[]> {
  const game = await setup(
    "big_plains",
    { strategicEconomy: true, infiniteGold: true, instantBuild: true },
    [
      new PlayerInfo("army", PlayerType.Human, "army-client", "army"),
      new PlayerInfo("rival", PlayerType.Human, "rival-client", "rival"),
    ],
  );
  const player = game.player("army");
  const rival = game.player("rival");
  const source = game.ref(50, 50);
  const destination = game.ref(51, 50);
  player.conquer(source);
  for (let y = 49; y <= 53; y++) {
    for (let x = 51; x <= 55; x++) rival.conquer(game.ref(x, y));
  }
  player.addTanks(1);
  rival.setTroops(100_000);
  const deployment = new ConstructionExecution(player, UnitType.Tank, source);
  deployment.init(game, 0);
  deployment.tick(0);
  const tank = player.units(UnitType.Tank)[0];
  const executor = new Executor(game, "tank-replay", undefined);
  game.addExecution(
    executor.createExec({
      type: "move_tank",
      unitIds: [tank.id()],
      tile: destination,
      clientID: "army-client",
    }),
  );
  const hashes: number[] = [];
  for (let tick = 0; tick < 20; tick++) {
    const updates = game.executeNextTick();
    hashes.push(
      ...((updates[GameUpdateType.Hash] as HashUpdate[] | undefined) ?? []).map(
        (update) => update.hash,
      ),
    );
  }
  return [
    ...hashes,
    tank.tile(),
    tank.health(),
    game.owner(destination).smallID(),
    rival.troops(),
    player.numTilesOwned(),
  ];
}

describe("independent tank deployment", () => {
  test("spends one reserve tank and creates a synchronized mobile unit", async () => {
    const game = await tankGame();
    const player = game.player("army");
    const tile = game.ref(50, 50);
    player.conquer(tile);
    player.addTanks(2);

    const buildable = player.buildableUnits(tile, [UnitType.Tank])[0];
    expect(buildable.canBuild).toBe(tile);

    const execution = new ConstructionExecution(player, UnitType.Tank, tile);
    execution.init(game, 0);
    execution.tick(0);

    const tank = player.units(UnitType.Tank)[0];
    expect(tank).toBeDefined();
    expect(tank.tile()).toBe(tile);
    expect(tank.maxHealth()).toBe(STRATEGIC_COMBAT.tankUnitMaxHealth);
    expect(player.tanks()).toBe(1);
    expect(game.unitCount(UnitType.Tank)).toBe(1);

    player.addTanks(1);
    expect(player.canBuild(UnitType.Tank, tile)).toBe(false);
  });

  test("rejects deployment without reserve, outside owned land, or above cap", async () => {
    const game = await tankGame();
    const player = game.player("army");
    const tile = game.ref(50, 50);
    player.conquer(tile);

    expect(player.canBuild(UnitType.Tank, tile)).toBe(false);
    player.addTanks(STRATEGIC_COMBAT.maxDeployedTanksPerPlayer + 1);
    expect(player.canBuild(UnitType.Tank, game.ref(51, 50))).toBe(false);

    for (let i = 0; i < STRATEGIC_COMBAT.maxDeployedTanksPerPlayer; i++) {
      const nextTile = game.ref(50 + i, 50);
      player.conquer(nextTile);
      const execution = new ConstructionExecution(
        player,
        UnitType.Tank,
        nextTile,
      );
      execution.init(game, i);
      execution.tick(i);
    }

    expect(player.unitCount(UnitType.Tank)).toBe(
      STRATEGIC_COMBAT.maxDeployedTanksPerPlayer,
    );
    expect(player.canBuild(UnitType.Tank, tile)).toBe(false);
  });

  test("keeps individual tank deployment disabled in legacy economy matches", async () => {
    const game = await tankGame(false);
    const player = game.player("army");
    const tile = game.ref(50, 50);
    player.conquer(tile);
    player.addTanks(1);

    expect(player.canBuild(UnitType.Tank, tile)).toBe(false);
    expect(player.units(UnitType.Tank)).toHaveLength(0);
  });

  test("moves only the ordered tank over owned land with deterministic steps", async () => {
    const game = await tankGame();
    const player = game.player("army");
    const source = game.ref(50, 50);
    const destination = game.ref(54, 50);
    for (let x = 50; x <= 54; x++) player.conquer(game.ref(x, 50));
    player.addTanks(1);
    player.setTroops(25_000);

    const deployment = new ConstructionExecution(player, UnitType.Tank, source);
    deployment.init(game, 0);
    deployment.tick(0);
    const tank = player.units(UnitType.Tank)[0];
    const execution = new MoveTankExecution(player, [tank.id()], destination);
    execution.init(game, 1);

    for (let tick = 0; tick < 8; tick++) execution.tick(tick);

    expect(tank.tile()).toBe(destination);
    expect(player.troops()).toBe(25_000);
    expect(tank.targetTile()).toBeUndefined();
    expect(execution.isActive()).toBe(false);
  });

  test("attacks and captures enemy land while applying territory casualties", async () => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("army", PlayerType.Human, "army-client", "army"),
        new PlayerInfo("rival", PlayerType.Human, "rival-client", "rival"),
      ],
    );
    const player = game.player("army");
    const rival = game.player("rival");
    const source = game.ref(50, 50);
    const destination = game.ref(51, 50);
    for (let x = 50; x <= 54; x++) player.conquer(game.ref(x, 50));
    for (let y = 49; y <= 53; y++) {
      for (let x = 51; x <= 55; x++) rival.conquer(game.ref(x, y));
    }
    player.addTanks(1);
    rival.setTroops(100_000);

    const deployment = new ConstructionExecution(player, UnitType.Tank, source);
    deployment.init(game, 0);
    deployment.tick(0);
    const tank = player.units(UnitType.Tank)[0];
    const execution = new MoveTankExecution(player, [tank.id()], destination);
    execution.init(game, 1);
    execution.tick(1);
    execution.tick(2);

    expect(game.owner(destination)).toBe(player);
    expect(tank.tile()).toBe(destination);
    expect(tank.health()).toBeLessThan(tank.maxHealth());
    expect(tank.isActive()).toBe(true);
    expect(rival.troops()).toBeLessThan(100_000);
  });

  test("destroys an enemy tank and captures its tile deterministically", async () => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("army", PlayerType.Human, "army-client", "army"),
        new PlayerInfo("rival", PlayerType.Human, "rival-client", "rival"),
      ],
    );
    const player = game.player("army");
    const rival = game.player("rival");
    const source = game.ref(50, 50);
    const battleTile = game.ref(51, 50);
    player.conquer(source);
    rival.conquer(battleTile);
    player.addTanks(1);
    rival.addTanks(1);

    for (const [owner, tile] of [
      [player, source],
      [rival, battleTile],
    ] as const) {
      const deployment = new ConstructionExecution(owner, UnitType.Tank, tile);
      deployment.init(game, 0);
      deployment.tick(0);
    }
    const attacker = player.units(UnitType.Tank)[0];
    const defender = rival.units(UnitType.Tank)[0];
    const execution = new MoveTankExecution(
      player,
      [attacker.id()],
      battleTile,
    );
    execution.init(game, 1);

    for (let tick = 1; tick <= 8; tick++) execution.tick(tick);

    expect(attacker.isActive()).toBe(true);
    expect(attacker.health()).toBeLessThan(attacker.maxHealth());
    expect(defender.isActive()).toBe(false);
    expect(game.owner(battleTile)).toBe(player);
    expect(attacker.tile()).toBe(battleTile);
  });

  test("replays a tank attack to the same synchronized state", async () => {
    expect(await deterministicAssaultResult()).toEqual(
      await deterministicAssaultResult(),
    );
  });
});
