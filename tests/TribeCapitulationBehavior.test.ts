import { TribeExecution } from "../src/core/execution/TribeExecution";
import {
  AllianceRequest,
  Player,
  PlayerInfo,
  PlayerType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

describe("tribal bot capitulation requests", () => {
  let game: Awaited<ReturnType<typeof setup>>;
  let tribe: Player;
  let requestor: Player;
  let execution: TribeExecution;

  beforeEach(async () => {
    game = await setup("plains", {}, [
      new PlayerInfo("tribe", PlayerType.Bot, null, "tribe"),
      new PlayerInfo("requestor", PlayerType.Human, null, "requestor"),
    ]);
    tribe = game.player("tribe");
    requestor = game.player("requestor");
    execution = new TribeExecution(tribe);
    execution.init(game);
  });

  function request(
    kind: "alliance" | "capitulation",
    createdAt = game.config().numSpawnPhaseTurns() + 2,
  ): AllianceRequest {
    return {
      kind: () => kind,
      requestor: () => requestor,
      createdAt: () => createdAt,
      territoryPercent: () => 0,
      accept: vi.fn(),
      reject: vi.fn(),
    } as unknown as AllianceRequest;
  }

  function handle(requests: AllianceRequest[]): void {
    vi.spyOn(tribe, "incomingAllianceRequests").mockReturnValue(requests);
    (execution as any).acceptAllAllianceRequests();
  }

  test("accepts only overwhelming capitulation demands", () => {
    for (let x = 10; x < 20; x++) tribe.conquer(game.ref(x, 10));
    for (let x = 30; x < 60; x++) requestor.conquer(game.ref(x, 10));
    vi.spyOn(tribe, "troops").mockReturnValue(100);
    vi.spyOn(requestor, "troops").mockReturnValue(500);
    const demand = request("capitulation");

    handle([demand]);

    expect(demand.accept).toHaveBeenCalledOnce();
    expect(demand.reject).not.toHaveBeenCalled();
  });

  test("rejects weak or stale capitulation demands", () => {
    const weakDemand = request("capitulation");
    const staleDemand = request(
      "capitulation",
      game.config().numSpawnPhaseTurns() + 1,
    );

    handle([weakDemand, staleDemand]);

    expect(weakDemand.accept).not.toHaveBeenCalled();
    expect(weakDemand.reject).toHaveBeenCalledOnce();
    expect(staleDemand.accept).not.toHaveBeenCalled();
    expect(staleDemand.reject).toHaveBeenCalledOnce();
  });

  test("continues accepting ordinary alliance requests", () => {
    const alliance = request("alliance");

    handle([alliance]);

    expect(alliance.accept).toHaveBeenCalledOnce();
    expect(alliance.reject).not.toHaveBeenCalled();
  });
});
