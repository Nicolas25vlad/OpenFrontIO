import { AllianceCancelExecution } from "../src/core/execution/alliance/AllianceCancelExecution";
import { AllianceRequestExecution } from "../src/core/execution/alliance/AllianceRequestExecution";
import { Game, Player, PlayerType } from "../src/core/game/Game";
import { GameUpdateType } from "../src/core/game/GameUpdates";
import { playerInfo, setup } from "./util/Setup";

describe("AllianceCancelExecution", () => {
  let game: Game;
  let requestor: Player;
  let recipient: Player;

  beforeEach(async () => {
    game = await setup("ocean_and_land", {}, [
      playerInfo("requestor", PlayerType.Human),
      playerInfo("recipient", PlayerType.Human),
    ]);
    requestor = game.player("requestor");
    recipient = game.player("recipient");
    vi.spyOn(requestor, "canSendAllianceRequest").mockReturnValue(true);
  });

  it("cancels only the request owned by the sender and syncs both clients", () => {
    game.addExecution(new AllianceRequestExecution(requestor, recipient.id()));
    game.executeNextTick();
    const [request] = requestor.outgoingAllianceRequests();
    expect(request).toBeDefined();

    const addUpdate = vi.spyOn(game, "addUpdate");
    game.addExecution(new AllianceCancelExecution(recipient, requestor.id()));
    game.executeNextTick();
    game.executeNextTick();
    expect(recipient.incomingAllianceRequests()).toContain(request);

    game.addExecution(new AllianceCancelExecution(requestor, recipient.id()));
    game.executeNextTick();
    game.executeNextTick();

    expect(request.status()).toBe("canceled");
    expect(requestor.outgoingAllianceRequests()).toHaveLength(0);
    expect(recipient.incomingAllianceRequests()).toHaveLength(0);
    expect(requestor.allianceWith(recipient)).toBeNull();
    expect(addUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: GameUpdateType.AllianceRequestReply,
        request: expect.objectContaining({
          requestorID: requestor.smallID(),
          recipientID: recipient.smallID(),
        }),
        accepted: false,
        canceled: true,
      }),
    );
  });

  it("does not change a request that has already been resolved", () => {
    game.addExecution(new AllianceRequestExecution(requestor, recipient.id()));
    game.executeNextTick();
    const [request] = requestor.outgoingAllianceRequests();
    request.reject();

    game.addExecution(new AllianceCancelExecution(requestor, recipient.id()));
    game.executeNextTick();
    game.executeNextTick();

    expect(request.status()).toBe("rejected");
    expect(requestor.outgoingAllianceRequests()).toHaveLength(0);
  });
});
