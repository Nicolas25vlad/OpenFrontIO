import { GameID } from "../../../src/core/Schemas";
import { AttackExecution } from "../../../src/core/execution/AttackExecution";
import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
//import { TransportShipExecution } from "../../../src/core/execution/TransportShipExecution";
import { AllianceRequestExecution } from "../../../src/core/execution/alliance/AllianceRequestExecution";
import { PEACE_TRUCE_DURATION_TICKS } from "../../../src/core/game/AllianceImpl";
import {
  Game,
  GameType,
  Player,
  PlayerInfo,
  PlayerType,
} from "../../../src/core/game/Game";
import { TileRef } from "../../../src/core/game/GameMap";
import { GameUpdateType } from "../../../src/core/game/GameUpdates";
import { setup } from "../../util/Setup";

const gameID: GameID = "game_id";
let game: Game;
let attacker: Player;
let defender: Player;
let defenderSpawn: TileRef;
let attackerSpawn: TileRef;

describe("GameImpl", () => {
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
    attackerSpawn = game.ref(0, 14);

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

    attacker = game.player(attackerInfo.id);
    defender = game.player(defenderInfo.id);
  });

  test("accepts a connected territory peace offer and starts a timed truce", async () => {
    const peaceGame = await setup(
      "plains",
      { infiniteGold: true, instantBuild: true },
      [],
      undefined,
      undefined,
      false,
    );
    const requestor = peaceGame.addPlayer(
      new PlayerInfo("requestor", PlayerType.Human, null, "requestor_id"),
    );
    const cedingPlayer = peaceGame.addPlayer(
      new PlayerInfo("ceding", PlayerType.Human, null, "ceding_id"),
    );
    const requestorTiles = [20, 21, 22].map((x) => peaceGame.ref(x, 20));
    const cedingTiles = [23, 24, 25, 26].map((x) => peaceGame.ref(x, 20));
    for (const tile of requestorTiles) requestor.conquer(tile);
    for (const tile of cedingTiles) cedingPlayer.conquer(tile);
    cedingPlayer.setSpawnTile(cedingTiles[3]);
    peaceGame.endSpawnPhase();

    const request = requestor.createAllianceRequest(cedingPlayer, 25);
    const hashBeforePeace = (peaceGame as any).hash();

    expect(request?.territoryPercent()).toBe(25);
    request?.accept();

    expect(request?.status()).toBe("accepted");
    expect(requestor.numTilesOwned()).toBe(4);
    expect(cedingPlayer.numTilesOwned()).toBe(3);
    expect(cedingPlayer.tiles().has(cedingTiles[3])).toBe(true);
    const truce = requestor.allianceWith(cedingPlayer)!;
    expect(truce.expiresAt()).toBe(
      peaceGame.ticks() + PEACE_TRUCE_DURATION_TICKS,
    );
    expect(requestor.canAttackPlayer(cedingPlayer)).toBe(false);
    expect(cedingPlayer.canAttackPlayer(requestor)).toBe(false);
    expect((peaceGame as any).hash()).not.toBe(hashBeforePeace);

    truce.expire();
    expect(requestor.allianceWith(cedingPlayer)).toBeNull();
    expect(requestor.canAttackPlayer(cedingPlayer)).toBe(true);
  });

  test("rejects stale peace terms without changing land or creating an alliance", async () => {
    const peaceGame = await setup(
      "plains",
      { infiniteGold: true, instantBuild: true },
      [],
      undefined,
      undefined,
      false,
    );
    const requestor = peaceGame.addPlayer(
      new PlayerInfo("requestor", PlayerType.Human, null, "requestor_id"),
    );
    const cedingPlayer = peaceGame.addPlayer(
      new PlayerInfo("ceding", PlayerType.Human, null, "ceding_id"),
    );
    for (const x of [20, 21, 22, 23]) {
      requestor.conquer(peaceGame.ref(x, 20));
      cedingPlayer.conquer(peaceGame.ref(x + 30, 20));
    }
    cedingPlayer.setSpawnTile(peaceGame.ref(53, 20));
    peaceGame.endSpawnPhase();
    const request = requestor.createAllianceRequest(cedingPlayer, 25);
    const requestorRelation = requestor.relation(cedingPlayer);

    peaceGame.addExecution(
      new AllianceRequestExecution(cedingPlayer, requestor.id()),
    );
    peaceGame.executeNextTick();

    expect(request?.status()).toBe("rejected");
    expect(requestor.numTilesOwned()).toBe(4);
    expect(cedingPlayer.numTilesOwned()).toBe(4);
    expect(requestor.allianceWith(cedingPlayer)).toBeNull();
    expect(requestor.relation(cedingPlayer)).toBe(requestorRelation);
  });

  test("Don't become traitor when betraying inactive player", async () => {
    vi.spyOn(attacker, "canSendAllianceRequest").mockReturnValue(true);
    vi.spyOn(defender, "canSendAllianceRequest").mockReturnValue(true);
    game.addExecution(new AllianceRequestExecution(attacker, defender.id()));
    game.executeNextTick();

    game.addExecution(new AllianceRequestExecution(defender, attacker.id()));
    game.executeNextTick();

    expect(attacker.allianceWith(defender)).toBeTruthy();
    expect(defender.allianceWith(attacker)).toBeTruthy();

    //Defender is marked disconnected
    defender.markDisconnected(true);

    game.executeNextTick();
    game.executeNextTick();

    // STEP 1: First betray (manually break alliance)
    const alliance = attacker.allianceWith(defender);
    expect(alliance).toBeTruthy();
    attacker.breakAlliance(alliance!);

    // STEP 2: Then attack after betrayal
    game.addExecution(new AttackExecution(100, attacker, defender.id()));

    do {
      game.executeNextTick();
    } while (attacker.outgoingAttacks().length > 0);

    expect(attacker.isTraitor()).toBe(false);
    expect(attacker.allianceWith(defender)).toBeFalsy();
  });

  test("Do become traitor when betraying active player", async () => {
    vi.spyOn(attacker, "canSendAllianceRequest").mockReturnValue(true);
    vi.spyOn(defender, "canSendAllianceRequest").mockReturnValue(true);
    game.addExecution(new AllianceRequestExecution(attacker, defender.id()));
    game.executeNextTick();

    game.addExecution(new AllianceRequestExecution(defender, attacker.id()));
    game.executeNextTick();

    expect(attacker.allianceWith(defender)).toBeTruthy();
    expect(defender.allianceWith(attacker)).toBeTruthy();

    //Defender is NOT marked disconnected

    game.executeNextTick();
    game.executeNextTick();

    // First betray (manually break alliance)
    const alliance = attacker.allianceWith(defender);
    expect(alliance).toBeTruthy();
    attacker.breakAlliance(alliance!);

    game.executeNextTick();

    game.addExecution(new AttackExecution(100, attacker, defender.id()));

    do {
      game.executeNextTick();
    } while (attacker.outgoingAttacks().length > 0);

    expect(attacker.isTraitor()).toBe(true);
    expect(attacker.allianceWith(defender)).toBeFalsy();
  });

  test("Singleplayer late human spawn gets spawn immunity", async () => {
    const singleplayerGame = await setup(
      "plains",
      {
        gameType: GameType.Singleplayer,
      },
      [],
      undefined,
      undefined,
      false,
    );
    (singleplayerGame.config() as any).setSpawnImmunityDuration(100);

    const pastSpawnCountdown =
      singleplayerGame.config().numSpawnPhaseTurns() + 20;
    for (let i = 0; i < pastSpawnCountdown; i++) {
      singleplayerGame.executeNextTick();
    }

    const lateHumanInfo = new PlayerInfo(
      "late human",
      PlayerType.Human,
      "late_client_id",
      "late_player_id",
    );

    singleplayerGame.addExecution(
      new SpawnExecution(gameID, lateHumanInfo, singleplayerGame.ref(5, 5)),
    );

    // First tick initializes the execution, second tick applies the spawn.
    singleplayerGame.executeNextTick();
    const spawnUpdates = singleplayerGame.executeNextTick();

    expect(singleplayerGame.player(lateHumanInfo.id).hasSpawned()).toBe(true);
    expect(spawnUpdates[GameUpdateType.SpawnPhaseEnd]).toHaveLength(1);
    expect(singleplayerGame.isSpawnImmunityActive()).toBe(true);
  });
});
