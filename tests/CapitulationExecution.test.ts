import { AttackExecution } from "../src/core/execution/AttackExecution";
import { AllianceRequestExecution } from "../src/core/execution/alliance/AllianceRequestExecution";
import { CapitulationExecution } from "../src/core/execution/alliance/CapitulationExecution";
import { Game, Player, PlayerType, UnitType } from "../src/core/game/Game";
import { GameUpdateType } from "../src/core/game/GameUpdates";
import { NaturalResource, ProcessedResource } from "../src/core/game/Resources";
import { playerInfo, setup } from "./util/Setup";

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
});
