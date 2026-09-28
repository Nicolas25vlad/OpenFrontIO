import { AttackExecution } from "../src/core/execution/AttackExecution";
import { Executor } from "../src/core/execution/ExecutionManager";
import { AllianceRequestExecution } from "../src/core/execution/alliance/AllianceRequestExecution";
import { CapitulationExecution } from "../src/core/execution/alliance/CapitulationExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { GameUpdateType, HashUpdate } from "../src/core/game/GameUpdates";
import { NaturalResource, ProcessedResource } from "../src/core/game/Resources";
import { playerInfo, setup } from "./util/Setup";

async function deterministicCapitulationResult(): Promise<number[]> {
  const game = await setup("plains", { infiniteGold: true }, [
    new PlayerInfo("proposer", PlayerType.Human, "proposer-client", "proposer"),
    new PlayerInfo(
      "recipient",
      PlayerType.Human,
      "recipient-client",
      "recipient",
    ),
  ]);
  const proposer = game.player("proposer");
  const recipient = game.player("recipient");
  proposer.conquer(game.ref(20, 20));
  recipient.conquer(game.ref(21, 20));
  recipient.conquer(game.ref(22, 20));
  recipient.setSpawnTile(game.ref(22, 20));
  game.endSpawnPhase();

  const executor = new Executor(game, "capitulation-replay", undefined);
  game.addExecution(
    executor.createExec({
      type: "capitulation",
      action: "propose",
      player: recipient.id(),
      clientID: "proposer-client",
    }),
  );
  game.executeNextTick();
  game.addExecution(
    executor.createExec({
      type: "capitulation",
      action: "accept",
      player: proposer.id(),
      clientID: "recipient-client",
    }),
  );
  const hashes: HashUpdate[] = [];
  for (let tick = 0; tick < 10; tick++) {
    const updates = game.executeNextTick();
    hashes.push(
      ...((updates[GameUpdateType.Hash] as HashUpdate[] | undefined) ?? []),
    );
  }

  return [
    ...hashes.map((update) => update.hash),
    proposer.numTilesOwned(),
    recipient.numTilesOwned(),
    recipient.isAlive() ? 1 : 0,
    recipient.outgoingAllianceRequests().length,
    proposer.incomingAllianceRequests().length,
  ];
}

describe("CapitulationExecution", () => {
  let game: Game;
  let proposer: Player;
  let recipient: Player;
  let thirdParty: Player;

  beforeEach(async () => {
    game = await setup(
      "plains",
      { infiniteGold: true, infiniteTroops: true, instantBuild: true },
      [
        playerInfo("proposer", PlayerType.Human),
        playerInfo("recipient", PlayerType.Human),
        playerInfo("third", PlayerType.Human),
      ],
    );
    proposer = game.player("proposer");
    recipient = game.player("recipient");
    thirdParty = game.player("third");
    proposer.conquer(game.ref(20, 20));
    recipient.conquer(game.ref(21, 20));
    recipient.conquer(game.ref(22, 20));
    recipient.setSpawnTile(game.ref(22, 20));
    thirdParty.conquer(game.ref(23, 20));
    game.endSpawnPhase();
  });

  test("requires recipient consent and only accepts the requestor intent", () => {
    const request = proposer.createAllianceRequest(
      recipient,
      0,
      "capitulation",
    );
    expect(request?.kind()).toBe("capitulation");

    game.addExecution(
      new CapitulationExecution(thirdParty, "accept", proposer.id()),
    );
    game.executeNextTick();
    expect(request?.status()).toBe("pending");
    expect(recipient.numTilesOwned()).toBe(2);

    game.addExecution(
      new CapitulationExecution(recipient, "accept", proposer.id()),
    );
    const addUpdate = vi.spyOn(game, "addUpdate");
    game.executeNextTick();
    expect(request?.status()).toBe("accepted");
    expect(recipient.numTilesOwned()).toBe(0);
    expect(proposer.numTilesOwned()).toBe(3);
    expect(recipient.tiles().size).toBe(0);
    expect(proposer.tiles().has(game.ref(22, 20))).toBe(true);
    expect(proposer.allianceWith(recipient)).toBeNull();
    expect(addUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ type: GameUpdateType.ConquestEvent }),
    );
  });

  test("transfers land and cancels active attacks as one accepted surrender", () => {
    game.addExecution(new AttackExecution(100, recipient, proposer.id()));
    game.addExecution(new AttackExecution(100, thirdParty, recipient.id()));
    game.executeNextTick();
    expect(recipient.outgoingAttacks().length).toBeGreaterThan(0);
    expect(recipient.incomingAttacks().length).toBeGreaterThan(0);
    recipient.buildUnit(UnitType.City, game.ref(21, 20), {});
    recipient.buildUnit(UnitType.AtomBomb, game.ref(21, 20), {
      targetTile: game.ref(20, 20),
      trajectory: [
        { tile: game.ref(21, 20), targetable: true },
        { tile: game.ref(20, 20), targetable: true },
      ],
    });
    recipient.addResource(NaturalResource.Oil, 50);
    recipient.addResource(ProcessedResource.Food, 25);

    const request = proposer.createAllianceRequest(
      recipient,
      0,
      "capitulation",
    );
    request?.accept();

    expect(request?.status()).toBe("accepted");
    expect(recipient.outgoingAttacks()).toHaveLength(0);
    expect(recipient.incomingAttacks()).toHaveLength(0);
    expect(recipient.units()).toHaveLength(0);
    expect(recipient.resourceAmount(NaturalResource.Oil)).toBe(0);
    expect(recipient.resourceAmount(ProcessedResource.Food)).toBe(0);
  });

  test("proposal remains pending until the recipient explicitly accepts", () => {
    game.addExecution(
      new CapitulationExecution(proposer, "propose", recipient.id()),
    );
    game.executeNextTick();

    const [request] = proposer.outgoingAllianceRequests();
    expect(request?.kind()).toBe("capitulation");
    expect(request?.status()).toBe("pending");
    expect(recipient.numTilesOwned()).toBe(2);
  });

  test("replays an accepted capitulation to the same synchronized state", async () => {
    const first = await deterministicCapitulationResult();
    const second = await deterministicCapitulationResult();

    expect(first.length).toBeGreaterThan(5);
    expect(first).toEqual(second);
  });

  test("an ordinary counter-request does not accept capitulation", () => {
    const request = proposer.createAllianceRequest(
      recipient,
      0,
      "capitulation",
    );
    game.addExecution(new AllianceRequestExecution(recipient, proposer.id()));
    game.executeNextTick();

    expect(request?.status()).toBe("pending");
    expect(proposer.allianceWith(recipient)).toBeNull();
    expect(recipient.numTilesOwned()).toBe(2);
  });

  test("only the recipient can reject and only the sender can cancel", () => {
    const request = proposer.createAllianceRequest(
      recipient,
      0,
      "capitulation",
    );
    game.addExecution(
      new CapitulationExecution(thirdParty, "reject", proposer.id()),
    );
    game.executeNextTick();
    expect(request?.status()).toBe("pending");

    game.addExecution(
      new CapitulationExecution(proposer, "cancel", recipient.id()),
    );
    game.executeNextTick();
    expect(request?.status()).toBe("canceled");
  });

  test("ignores an accept intent after the capitulation request is stale", () => {
    const request = proposer.createAllianceRequest(
      recipient,
      0,
      "capitulation",
    );
    request?.reject();

    game.addExecution(
      new CapitulationExecution(recipient, "accept", proposer.id()),
    );
    game.executeNextTick();

    expect(request?.status()).toBe("rejected");
    expect(recipient.numTilesOwned()).toBe(2);
    expect(proposer.numTilesOwned()).toBe(1);
    expect(proposer.allianceWith(recipient)).toBeNull();
  });
});
