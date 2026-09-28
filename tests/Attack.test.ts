import { AttackExecution } from "../src/core/execution/AttackExecution";
import { SpawnExecution } from "../src/core/execution/SpawnExecution";
import { TransportShipExecution } from "../src/core/execution/TransportShipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { TileRef } from "../src/core/game/GameMap";
import { GameUpdateType, UnitUpdate } from "../src/core/game/GameUpdates";
import { GameID } from "../src/core/Schemas";
import { setup } from "./util/Setup";
import { TestConfig } from "./util/TestConfig";
import { constructionExecution } from "./util/utils";

let game: Game;
const gameID: GameID = "game_id";
let attacker: Player;
let defender: Player;
let defenderSpawn: TileRef;
let attackerSpawn: TileRef;

function sendBoat(target: TileRef, troops: number) {
  game.addExecution(new TransportShipExecution(defender, target, troops));
}

const immunityPhaseTicks = 10;
function waitForImmunityToEnd() {
  for (let i = 0; i < immunityPhaseTicks + 1; i++) {
    game.executeNextTick();
  }
}

describe("Attack", () => {
  beforeEach(async () => {
    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
      infiniteTroops: true,
    });
    const attackerInfo = new PlayerInfo(
      "attacker dude",
      PlayerType.Human,
      null,
      "attacker_id",
    );
    game.addPlayer(attackerInfo);
    const defenderInfo = new PlayerInfo(
      "defender dude",
      PlayerType.Human,
      null,
      "defender_id",
    );
    game.addPlayer(defenderInfo);

    defenderSpawn = game.ref(0, 15);
    attackerSpawn = game.ref(0, 10);

    game.addExecution(
      new SpawnExecution(
        gameID,
        game.player(attackerInfo.id).info(),
        attackerSpawn,
      ),
      new SpawnExecution(
        gameID,
        game.player(defenderInfo.id).info(),
        defenderSpawn,
      ),
    );
    game.executeNextTick();
    game.executeNextTick();

    attacker = game.player(attackerInfo.id);
    defender = game.player(defenderInfo.id);

    game.addExecution(
      new AttackExecution(100, defender, game.terraNullius().id()),
    );
    game.executeNextTick();
    while (defender.outgoingAttacks().length > 0) {
      game.executeNextTick();
    }

    (game.config() as TestConfig).setDefaultNukeSpeed(50);
  });

  test("Nuke reduce attacking troop counts", async () => {
    // Not building exactly spawn to it's better protected from attacks (but still
    // on defender territory)
    constructionExecution(game, defender, 1, 1, UnitType.MissileSilo);
    expect(defender.units(UnitType.MissileSilo)).toHaveLength(1);
    game.addExecution(new AttackExecution(100, attacker, defender.id()));
    constructionExecution(game, defender, 0, 15, UnitType.AtomBomb, 3);
    const nuke = defender.units(UnitType.AtomBomb)[0];
    expect(nuke.isActive()).toBe(true);

    expect(attacker.outgoingAttacks()).toHaveLength(1);
    expect(attacker.outgoingAttacks()[0].troops()).toBe(98);

    // Make the nuke go kaboom
    game.executeNextTick();
    expect(nuke.isActive()).toBe(false);
    expect(attacker.outgoingAttacks()[0].troops()).not.toBe(97);
    expect(attacker.outgoingAttacks()[0].troops()).toBeLessThan(90);
  });

  test("Nuke reduce attacking boat troop count", async () => {
    constructionExecution(game, defender, 1, 1, UnitType.MissileSilo);
    expect(defender.units(UnitType.MissileSilo)).toHaveLength(1);

    sendBoat(game.ref(15, 8), 100);

    constructionExecution(game, defender, 0, 15, UnitType.AtomBomb, 3);
    const nuke = defender.units(UnitType.AtomBomb)[0];
    expect(nuke.isActive()).toBe(true);

    const ship = defender.units(UnitType.TransportShip)[0];
    expect(ship.troops()).toBe(100);

    const updates = game.executeNextTick();
    const updatedShip = defender.units(UnitType.TransportShip)[0];
    const shipUpdates = (updates[GameUpdateType.Unit] as UnitUpdate[]).filter(
      (u) => u.id === ship.id(),
    );

    expect(nuke.isActive()).toBe(false);
    expect(updatedShip.troops()).toBeLessThan(90);
    expect(shipUpdates).toContainEqual(
      expect.objectContaining({
        id: ship.id(),
        unitType: UnitType.TransportShip,
        troops: updatedShip.troops(),
        transportShipState: expect.objectContaining({
          troops: updatedShip.troops(),
        }),
      }),
    );
  });

  test("Boat penalty on retreat Transport Ship arrival", async () => {
    const player_start_troops = defender.troops();
    const boat_troops = player_start_troops * 0.5;

    sendBoat(game.ref(15, 8), boat_troops);

    game.executeNextTick();

    const ship = defender.units(UnitType.TransportShip)[0];
    expect(ship.troops()).toBe(boat_troops);
    expect(ship.isActive()).toBe(true);

    ship.updateTransportShipState({ isRetreating: true });
    game.executeNextTick();

    expect(ship.isActive()).toBe(false);
    expect(boat_troops).toBeLessThan(defender.troops());
    expect(defender.troops()).toBeLessThan(player_start_troops);
  });
});

describe("land attack tanks", () => {
  test("commits a troop-proportional tank force and includes it in combat strength", async () => {
    const tankGame = await setup("ocean_and_land", {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    });
    const tankAttackerInfo = new PlayerInfo(
      "tank attacker",
      PlayerType.Human,
      null,
      "tank_attacker_id",
    );
    tankGame.addPlayer(tankAttackerInfo);
    const tankAttacker = tankGame.player(tankAttackerInfo.id);
    const spawn = tankGame.ref(0, 10);
    tankGame.addExecution(
      new SpawnExecution(gameID, tankAttacker.info(), spawn),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    tankAttacker.addTroops(25_000);
    tankAttacker.addTanks(3);
    let observedAttackStrength = 0;
    let observedAttackTanks = 0;
    const testConfig = tankGame.config() as TestConfig;
    testConfig.attackLogic = (input) => {
      observedAttackStrength = input.attackTroops;
      observedAttackTanks = input.attacker.tanks ?? 0;
      return { attackerTroopLoss: 1, defenderTroopLoss: 0, tickFraction: 1 };
    };

    tankGame.addExecution(
      new AttackExecution(25_000, tankAttacker, tankGame.terraNullius().id()),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    expect(tankAttacker.tanks()).toBe(1);
    expect(tankAttacker.outgoingAttacks()).toHaveLength(1);
    expect(tankAttacker.outgoingAttacks()[0].tanks()).toBe(2);
    expect(observedAttackStrength).toBe(35_000);
    expect(observedAttackTanks).toBe(2);

    tankAttacker.outgoingAttacks()[0].executeRetreat();
    tankGame.executeNextTick();
    expect(tankAttacker.tanks()).toBe(3);
    expect(tankAttacker.outgoingAttacks()).toHaveLength(0);
  });

  test("respects a lower requested tank count without exceeding inventory", async () => {
    const tankGame = await setup("ocean_and_land", {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    });
    const attackerInfo = new PlayerInfo(
      "selected tank attacker",
      PlayerType.Human,
      null,
      "selected_tank_attacker_id",
    );
    tankGame.addPlayer(attackerInfo);
    const attacker = tankGame.player(attackerInfo.id);
    tankGame.addExecution(
      new SpawnExecution(gameID, attacker.info(), tankGame.ref(0, 10)),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    attacker.addTroops(25_000);
    attacker.addTanks(3);
    let observedAttackStrength = 0;
    (tankGame.config() as TestConfig).attackLogic = (input) => {
      observedAttackStrength = input.attackTroops;
      return { attackerTroopLoss: 1, defenderTroopLoss: 0, tickFraction: 1 };
    };

    tankGame.addExecution(
      new AttackExecution(
        25_000,
        attacker,
        tankGame.terraNullius().id(),
        null,
        true,
        null,
        1,
      ),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    expect(attacker.tanks()).toBe(2);
    expect(attacker.outgoingAttacks()[0].tanks()).toBe(1);
    expect(observedAttackStrength).toBe(30_000);
  });

  test("takes deterministic tank casualties in player combat", async () => {
    const tankGame = await setup("ocean_and_land", {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    });
    const attackerInfo = new PlayerInfo(
      "tank combat attacker",
      PlayerType.Human,
      null,
      "tank_combat_attacker_id",
    );
    const defenderInfo = new PlayerInfo(
      "tank combat defender",
      PlayerType.Human,
      null,
      "tank_combat_defender_id",
    );
    tankGame.addPlayer(attackerInfo);
    tankGame.addPlayer(defenderInfo);
    const tankAttacker = tankGame.player(attackerInfo.id);
    const defender = tankGame.player(defenderInfo.id);
    const attackerSpawn = tankGame.ref(0, 10);
    tankGame.addExecution(
      new SpawnExecution(gameID, tankAttacker.info(), attackerSpawn),
      new SpawnExecution(gameID, defender.info(), tankGame.ref(0, 15)),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    const neighbors: TileRef[] = [0, 0, 0, 0];
    const numNeighbors = tankGame.map().neighbors4(attackerSpawn, neighbors);
    const combatTile = neighbors
      .slice(0, numNeighbors)
      .find((tile) => tankGame.map().isLand(tile));
    expect(combatTile).toBeDefined();
    defender.conquer(combatTile!);

    tankAttacker.addTroops(10_000);
    tankAttacker.addTanks(1);
    let observedAttackStrength = 0;
    const testConfig = tankGame.config() as TestConfig;
    testConfig.attackLogic = (input) => {
      observedAttackStrength = input.attackTroops;
      return {
        attackerTroopLoss: 2_000,
        defenderTroopLoss: 0,
        tickFraction: 1,
      };
    };
    tankGame.addExecution(
      new AttackExecution(10_000, tankAttacker, defender.id()),
    );
    tankGame.executeNextTick();
    tankGame.executeNextTick();

    expect(observedAttackStrength).toBe(15_000);
    expect(tankAttacker.outgoingAttacks()).toHaveLength(1);
    expect(tankAttacker.outgoingAttacks()[0].tanks()).toBe(0);
    expect(tankAttacker.tanks()).toBe(0);
  });

  test("leveled fortifications strengthen and wear down under attack", async () => {
    const fortGame = await setup("ocean_and_land", {
      strategicEconomy: true,
      infiniteGold: true,
      instantBuild: true,
    });
    const attackerInfo = new PlayerInfo(
      "fortification attacker",
      PlayerType.Human,
      null,
      "fortification_attacker_id",
    );
    const defenderInfo = new PlayerInfo(
      "fortification defender",
      PlayerType.Human,
      null,
      "fortification_defender_id",
    );
    fortGame.addPlayer(attackerInfo);
    fortGame.addPlayer(defenderInfo);
    const fortAttacker = fortGame.player(attackerInfo.id);
    const fortDefender = fortGame.player(defenderInfo.id);
    const attackerSpawn = fortGame.ref(0, 10);
    fortGame.addExecution(
      new SpawnExecution(gameID, fortAttacker.info(), attackerSpawn),
      new SpawnExecution(gameID, fortDefender.info(), fortGame.ref(0, 15)),
    );
    fortGame.executeNextTick();
    fortGame.executeNextTick();

    const neighbors: TileRef[] = [0, 0, 0, 0];
    const numNeighbors = fortGame.map().neighbors4(attackerSpawn, neighbors);
    const combatTile = neighbors
      .slice(0, numNeighbors)
      .find((tile) => fortGame.map().isLand(tile));
    expect(combatTile).toBeDefined();
    fortDefender.conquer(combatTile!);
    const post = fortDefender.buildUnit(UnitType.DefensePost, combatTile!, {});
    fortDefender.upgradeUnit(post);
    fortDefender.upgradeUnit(post);
    fortGame.setTrenchLevel(combatTile!, 2);

    let observedPostLevel = 0;
    let observedTrenchLevel = 0;
    const testConfig = fortGame.config() as TestConfig;
    testConfig.attackLogic = (input) => {
      observedPostLevel = input.defenderDefensePostLevel ?? 0;
      observedTrenchLevel = input.defenderTrenchLevel ?? 0;
      return { attackerTroopLoss: 1, defenderTroopLoss: 0, tickFraction: 1 };
    };
    fortAttacker.addTroops(10_000);
    fortGame.addExecution(
      new AttackExecution(10_000, fortAttacker, fortDefender.id()),
    );
    fortGame.executeNextTick();
    fortGame.executeNextTick();

    expect(observedPostLevel).toBe(3);
    expect(observedTrenchLevel).toBe(2);
    expect(post.health()).toBe(475);
    expect(fortGame.trenchLevel(combatTile!)).toBe(0);
  });
});

let playerA: Player;
let playerB: Player;

function addPlayerToGame(
  playerInfo: PlayerInfo,
  game: Game,
  tile: TileRef,
): Player {
  game.addPlayer(playerInfo);
  game.addExecution(new SpawnExecution(gameID, playerInfo, tile));
  return game.player(playerInfo.id);
}

describe("Attack race condition with alliance requests", () => {
  beforeEach(async () => {
    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
      infiniteTroops: true,
    });

    const playerAInfo = new PlayerInfo(
      "playerA",
      PlayerType.Human,
      null,
      "playerA_id",
    );
    playerA = addPlayerToGame(playerAInfo, game, game.ref(0, 10));

    const playerBInfo = new PlayerInfo(
      "playerB",
      PlayerType.Human,
      null,
      "playerB_id",
    );
    playerB = addPlayerToGame(playerBInfo, game, game.ref(0, 11));
    game.executeNextTick();
    game.executeNextTick();
  });

  it("Should not mark attacker as traitor when alliance is formed after attack starts", async () => {
    // Player A sends alliance request to Player B
    const allianceRequest = playerA.createAllianceRequest(playerB);
    expect(allianceRequest).not.toBeNull();

    // Player A attacks Player B
    const attackExecution = new AttackExecution(
      null,
      playerA,
      playerB.id(),
      null,
    );
    game.addExecution(attackExecution);

    // Player B counter-attacks Player A
    const counterAttackExecution = new AttackExecution(
      null,
      playerB,
      playerA.id(),
      null,
    );

    // Player B accepts the alliance request
    if (allianceRequest) {
      allianceRequest.accept();
    }

    game.addExecution(counterAttackExecution);

    // Execute a few ticks to process the attacks
    for (let i = 0; i < 5; i++) {
      game.executeNextTick();
    }

    expect(playerA.isAlive()).toBe(true);
    expect(playerB.isAlive()).toBe(true);

    // Player A should not be marked as traitor because the alliance was formed after the attack started
    expect(playerA.isTraitor()).toBe(false);

    expect(playerA.isAlliedWith(playerB)).toBe(true);
    expect(playerB.isAlliedWith(playerA)).toBe(true);
    // The attacks should have retreated due to the alliance being formed
    expect(playerA.outgoingAttacks()).toHaveLength(0);
    expect(playerB.outgoingAttacks()).toHaveLength(0);
  });

  it("Should prevent player from attacking allied player", async () => {
    // Create an alliance between Player A and Player B
    const allianceRequest = playerA.createAllianceRequest(playerB);
    if (allianceRequest) {
      allianceRequest.accept();
    }

    // Verify alliance exists
    expect(playerA.isAlliedWith(playerB)).toBe(true);
    expect(playerB.isAlliedWith(playerA)).toBe(true);

    // Player A tries to attack Player B (should be blocked)
    const attackExecution = new AttackExecution(
      null,
      playerA,
      playerB.id(),
      null,
    );
    game.addExecution(attackExecution);

    // Execute a few ticks to process the attack
    for (let i = 0; i < 10; i++) {
      game.executeNextTick();
    }

    // No ongoing attacks should exist for either side
    expect(playerA.outgoingAttacks()).toHaveLength(0);
    expect(playerB.outgoingAttacks()).toHaveLength(0);
    expect(playerA.incomingAttacks()).toHaveLength(0);
    expect(playerB.incomingAttacks()).toHaveLength(0);
  });

  test("Should cancel alliance requests if the recipient attacks", async () => {
    // Player A sends alliance request to Player B
    const allianceRequest = playerA.createAllianceRequest(playerB);
    expect(allianceRequest).not.toBeNull();
    expect(playerB.incomingAllianceRequests()).toHaveLength(1);

    // Player B attacks Player A
    const attackExecution = new AttackExecution(
      null,
      playerB,
      playerA.id(),
      null,
    );
    game.addExecution(attackExecution);

    // Execute a few ticks to process the attacks
    for (let i = 0; i < 5; i++) {
      game.executeNextTick();
    }
    // Alliance request should be denied since player B attacked
    expect(playerA.outgoingAllianceRequests()).toHaveLength(0);
    expect(playerB.incomingAllianceRequests()).toHaveLength(0);
  });

  test("Should cancel the proper alliance request among many", async () => {
    // Add a new player to have more alliance requests
    const playerCInfo = new PlayerInfo(
      "playerB",
      PlayerType.Human,
      null,
      "playerB_id",
    );
    const playerC = addPlayerToGame(playerCInfo, game, game.ref(10, 10));
    game.executeNextTick();
    game.executeNextTick();

    // Player A sends alliance request to Player B
    const allianceRequestAtoB = playerA.createAllianceRequest(playerB);
    expect(allianceRequestAtoB).not.toBeNull();

    // Player C also sends alliance request to Player B
    const allianceRequestCtoB = playerC.createAllianceRequest(playerB);
    expect(allianceRequestCtoB).not.toBeNull();

    expect(playerB.incomingAllianceRequests()).toHaveLength(2);

    // Player B attacks Player A
    const attackExecution = new AttackExecution(
      null,
      playerB,
      playerA.id(),
      null,
    );
    game.addExecution(attackExecution);

    // Execute a few ticks to process the attacks
    for (let i = 0; i < 5; i++) {
      game.executeNextTick();
    }
    // Alliance request A->B should be denied since player B attacked
    expect(playerA.outgoingAllianceRequests()).toHaveLength(0);
    // However C->B should remain
    expect(playerB.incomingAllianceRequests()).toHaveLength(1);
  });
});

describe("Transport ship alliance rejection", () => {
  beforeEach(async () => {
    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
      infiniteTroops: true,
    });

    const playerAInfo = new PlayerInfo(
      "playerA",
      PlayerType.Human,
      null,
      "playerA_id",
    );
    // close to the water to send boats
    playerA = addPlayerToGame(playerAInfo, game, game.ref(7, 0));

    const playerBInfo = new PlayerInfo(
      "playerB",
      PlayerType.Human,
      null,
      "playerB_id",
    );
    playerB = addPlayerToGame(playerBInfo, game, game.ref(7, 15));
    game.executeNextTick();
    game.executeNextTick();
  });

  test("Should cancel alliance requests if the recipient sends a transport ship", async () => {
    // Player A sends alliance request to Player B
    const allianceRequest = playerA.createAllianceRequest(playerB);
    expect(allianceRequest).not.toBeNull();
    expect(playerB.incomingAllianceRequests()).toHaveLength(1);

    // Player B sends a transport ship toward Player A's territory
    game.addExecution(new TransportShipExecution(playerB, game.ref(7, 0), 0));

    // Execute a tick to process the transport ship launch
    game.executeNextTick();

    // Alliance request should be rejected since player B sent a naval invasion
    expect(playerA.outgoingAllianceRequests()).toHaveLength(0);
    expect(playerB.incomingAllianceRequests()).toHaveLength(0);
  });
});

describe("Attack immunity", () => {
  beforeEach(async () => {
    game = await setup(
      "ocean_and_land",
      {
        infiniteGold: true,
        instantBuild: true,
        infiniteTroops: true,
      },
      [],
      undefined,
      undefined,
      false,
    );

    (game.config() as TestConfig).setSpawnImmunityDuration(immunityPhaseTicks);

    const playerAInfo = new PlayerInfo(
      "playerA",
      PlayerType.Human,
      null,
      "playerA_id",
    );
    // close to the water to send boats
    playerA = addPlayerToGame(playerAInfo, game, game.ref(7, 0));

    const playerBInfo = new PlayerInfo(
      "playerB",
      PlayerType.Human,
      null,
      "playerB_id",
    );
    playerB = addPlayerToGame(playerBInfo, game, game.ref(7, 15));
    game.executeNextTick();
    game.executeNextTick();
  });

  test("Should not be able to attack during immunity phase", async () => {
    // Player A attacks Player B
    const attackExecution = new AttackExecution(
      null,
      playerA,
      playerB.id(),
      null,
    );
    game.addExecution(attackExecution);
    game.executeNextTick();
    expect(playerA.outgoingAttacks()).toHaveLength(0);
  });

  test("Should be able to attack after immunity phase", async () => {
    waitForImmunityToEnd();
    // Player A attacks Player B
    const attackExecution = new AttackExecution(
      null,
      playerA,
      playerB.id(),
      null,
    );
    game.addExecution(attackExecution);
    game.executeNextTick();
    expect(playerA.outgoingAttacks()).toHaveLength(1);
  });

  test("Ensure a player can't attack during all the immunity phase", async () => {
    // Execute a few ticks but stop right before the immunity phase is over
    for (let i = 0; i < immunityPhaseTicks - 2; i++) {
      game.executeNextTick();
    }
    // Player A attacks Player B
    game.addExecution(new AttackExecution(null, playerA, playerB.id(), null));
    game.executeNextTick(); // ticks === immunityPhaseTicks - 1 here
    // Attack is not possible during immunity
    expect(playerA.outgoingAttacks()).toHaveLength(0);

    // Retry after the immunity is over
    game.executeNextTick(); // ticks === immunityPhaseTicks
    game.addExecution(new AttackExecution(null, playerA, playerB.id(), null));
    game.executeNextTick();
    // Attack is now possible right after
    expect(playerA.outgoingAttacks()).toHaveLength(1);
  });

  test("Should not be able to send a boat during immunity phase", async () => {
    // Player A sends a boat targeting Player B
    game.addExecution(new TransportShipExecution(playerA, game.ref(7, 15), 10));
    game.executeNextTick();
    expect(playerA.units(UnitType.TransportShip)).toHaveLength(0);
  });

  test("Should be able to send a boat after immunity phase", async () => {
    waitForImmunityToEnd();
    // Player A sends a boat targeting Player B
    game.addExecution(new TransportShipExecution(playerA, game.ref(7, 15), 10));
    game.executeNextTick();
    expect(playerA.units(UnitType.TransportShip)).toHaveLength(1);
  });

  test("Should not be able to attack nations during nation immunity phase", async () => {
    (game.config() as TestConfig).setNationSpawnImmunityDuration(
      immunityPhaseTicks,
    );
    const nationId = "nation_id";
    const nation = new PlayerInfo("nation", PlayerType.Nation, null, nationId);
    game.addPlayer(nation);
    // Player A attacks the nation during nation immunity
    const attackExecution = new AttackExecution(null, playerA, nationId, null);
    game.addExecution(attackExecution);
    game.executeNextTick();
    expect(playerA.outgoingAttacks()).toHaveLength(0);
  });

  test("Should be able to attack nations after nation immunity phase", async () => {
    (game.config() as TestConfig).setNationSpawnImmunityDuration(
      immunityPhaseTicks,
    );
    const nationId = "nation_id";
    const nation = new PlayerInfo("nation", PlayerType.Nation, null, nationId);
    game.addPlayer(nation);
    waitForImmunityToEnd();
    // Player A attacks the nation after immunity
    const attackExecution = new AttackExecution(null, playerA, nationId, null);
    game.addExecution(attackExecution);
    game.executeNextTick();
    expect(playerA.outgoingAttacks()).toHaveLength(1);
  });

  test("Should be able to attack bots during immunity phase", async () => {
    const botId = "bot_id";
    const bot = new PlayerInfo("bot", PlayerType.Bot, null, botId);
    game.addPlayer(bot);
    // Player A attacks the bot
    const attackExecution = new AttackExecution(null, playerA, botId, null);
    game.addExecution(attackExecution);
    game.executeNextTick();
    expect(playerA.outgoingAttacks()).toHaveLength(1);
  });

  test("Can't send nuke during immunity phase", async () => {
    constructionExecution(game, playerA, 7, 0, UnitType.MissileSilo);
    expect(playerA.units(UnitType.MissileSilo)).toHaveLength(1);
    // Player A sends a bomb to player B
    constructionExecution(game, playerA, 0, 11, UnitType.AtomBomb, 3);
    expect(playerA.units(UnitType.AtomBomb)).toHaveLength(0);
    // Now wait for immunity to end
    waitForImmunityToEnd();
    // And send the exact same order
    constructionExecution(game, playerA, 0, 11, UnitType.AtomBomb, 3);
    expect(playerA.units(UnitType.AtomBomb)).toHaveLength(1);
  });

  test("Should abort TransportShipExecution when target is the attacker itself", async () => {
    // Wait for spawn immunity to end to ensure it doesn't prematurely abort the execution
    waitForImmunityToEnd();

    // playerA tries to send a transport ship targeting one of playerA's own tiles (spawn tile at 7, 0)
    const selfTarget = game.ref(7, 0);
    const exec = new TransportShipExecution(playerA, selfTarget, 10);
    game.addExecution(exec);
    game.executeNextTick();

    // Verify it aborted immediately: active is false, and no transport ship unit spawned
    expect(exec.isActive()).toBe(false);
    expect(playerA.units(UnitType.TransportShip)).toHaveLength(0);
  });

  test("Nation can attack human during PVP immunity", async () => {
    const nationInfo = new PlayerInfo(
      "nation",
      PlayerType.Nation,
      null,
      "nation_id",
    );
    const nation = addPlayerToGame(nationInfo, game, game.ref(15, 0));
    game.executeNextTick();
    game.executeNextTick();

    // Nation attacks playerA during PVP immunity - should succeed
    game.addExecution(new AttackExecution(null, nation, "playerA_id", null));
    game.executeNextTick();
    expect(nation.outgoingAttacks()).toHaveLength(1);
  });

  test("Bot can attack human during PVP immunity", async () => {
    const botInfo = new PlayerInfo("bot", PlayerType.Bot, null, "bot_id");
    const bot = addPlayerToGame(botInfo, game, game.ref(15, 0));
    game.executeNextTick();
    game.executeNextTick();

    // Bot attacks playerA during PVP immunity - should succeed
    game.addExecution(new AttackExecution(null, bot, "playerA_id", null));
    game.executeNextTick();
    expect(bot.outgoingAttacks()).toHaveLength(1);
  });

  test("Nation can attack nation during PVP immunity", async () => {
    const nationAInfo = new PlayerInfo(
      "nationA",
      PlayerType.Nation,
      null,
      "nationA_id",
    );
    const nationA = addPlayerToGame(nationAInfo, game, game.ref(15, 0));

    const nationBInfo = new PlayerInfo(
      "nationB",
      PlayerType.Nation,
      null,
      "nationB_id",
    );
    addPlayerToGame(nationBInfo, game, game.ref(15, 15));
    game.executeNextTick();
    game.executeNextTick();

    // Nation A attacks Nation B during PVP immunity - should succeed
    game.addExecution(new AttackExecution(null, nationA, "nationB_id", null));
    game.executeNextTick();
    expect(nationA.outgoingAttacks()).toHaveLength(1);
  });

  test("Nation cannot attack allied human during PVP immunity", async () => {
    const nationInfo = new PlayerInfo(
      "nation",
      PlayerType.Nation,
      null,
      "nation_id",
    );
    const nation = addPlayerToGame(nationInfo, game, game.ref(15, 0));
    game.executeNextTick();
    game.executeNextTick();

    // Create alliance between nation and playerA
    const allianceRequest = nation.createAllianceRequest(playerA);
    if (allianceRequest) {
      allianceRequest.accept();
    }
    expect(nation.isAlliedWith(playerA)).toBe(true);

    // Nation tries to attack allied playerA during immunity - should be blocked by friendliness
    game.addExecution(new AttackExecution(null, nation, "playerA_id", null));
    game.executeNextTick();
    expect(nation.outgoingAttacks()).toHaveLength(0);
  });
});

describe("Fractional attack troop duplication (#4948)", () => {
  let dupeGame: Game;
  let dupeAttacker: Player;
  let dupeDefender: Player;

  beforeEach(async () => {
    dupeGame = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
    });
    const attackerInfo = new PlayerInfo(
      "attacker dude",
      PlayerType.Human,
      null,
      "attacker_id",
    );
    const defenderInfo = new PlayerInfo(
      "defender dude",
      PlayerType.Human,
      null,
      "defender_id",
    );
    dupeGame.addPlayer(attackerInfo);
    dupeGame.addPlayer(defenderInfo);

    dupeGame.addExecution(
      new SpawnExecution(
        gameID,
        dupeGame.player(attackerInfo.id).info(),
        dupeGame.ref(0, 10),
      ),
      new SpawnExecution(
        gameID,
        dupeGame.player(defenderInfo.id).info(),
        dupeGame.ref(0, 15),
      ),
    );
    dupeGame.executeNextTick();
    dupeGame.executeNextTick();

    dupeAttacker = dupeGame.player(attackerInfo.id);
    dupeDefender = dupeGame.player(defenderInfo.id);
  });

  function outgoingTroops(): number {
    return dupeAttacker
      .outgoingAttacks()
      .reduce((sum, attack) => sum + attack.troops(), 0);
  }

  it("carries only the troops that were actually deducted", () => {
    dupeGame.addExecution(
      new AttackExecution(50.7, dupeAttacker, dupeDefender.id()),
    );
    dupeGame.executeNextTick();

    // removeTroops() floors, so 50.7 costs the owner 50. The attack must not
    // be worth more than that, or retreat refunds troops nobody paid for.
    expect(outgoingTroops()).toBe(50);
  });

  it("does not accumulate value from a burst of sub-troop attacks", () => {
    for (let i = 0; i < 10; i++) {
      dupeGame.addExecution(
        new AttackExecution(0.999, dupeAttacker, dupeDefender.id()),
      );
    }
    dupeGame.executeNextTick();

    // Each request deducts 0. Combining ten of them must not produce an
    // attack worth 9.99 that retreat would refund as 9 free troops.
    expect(outgoingTroops()).toBe(0);
  });

  it("keeps attack troops integral so combining cannot drift", () => {
    for (let i = 0; i < 5; i++) {
      dupeGame.addExecution(
        new AttackExecution(20.4, dupeAttacker, dupeDefender.id()),
      );
    }
    dupeGame.executeNextTick();

    expect(Number.isInteger(outgoingTroops())).toBe(true);
    expect(outgoingTroops()).toBe(100);
  });
});
