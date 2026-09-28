import {
  isAlliancePartnerThreat,
  shouldAcceptCapitulation,
} from "../src/core/execution/nation/CapitulationPolicy";
import { Difficulty, Game, Player, PlayerType } from "../src/core/game/Game";

function policyFixture(
  difficulty: Difficulty,
  options: {
    requestorTroops?: number;
    recipientTroops?: number;
    requestorTiles?: number;
    recipientTiles?: number;
    requestorMaxTroops?: number;
    recipientMaxTroops?: number;
    requestorAlliances?: number;
  } = {},
) {
  const recipient = {
    type: () => PlayerType.Nation,
    isTraitor: () => false,
    isFriendly: () => false,
    troops: () => options.recipientTroops ?? 100,
    numTilesOwned: () => options.recipientTiles ?? 10,
    alliances: () => [],
    maxTroops: options.recipientMaxTroops ?? 1_000,
  } as unknown as Player;
  const requestor = {
    type: () => PlayerType.Human,
    isTraitor: () => false,
    isFriendly: () => false,
    troops: () => options.requestorTroops ?? 500,
    numTilesOwned: () => options.requestorTiles ?? 30,
    alliances: () => new Array(options.requestorAlliances ?? 0),
    maxTroops: options.requestorMaxTroops ?? 3_000,
  } as unknown as Player;
  const config = {
    gameConfig: () => ({ difficulty }),
    maxTroops: (player: Player) => (player as any).maxTroops,
  };
  const game = {
    config: () => config,
    players: () => [recipient, requestor],
  } as unknown as Game;

  return { game, recipient, requestor };
}

describe("shared capitulation policy", () => {
  test("Easy difficulty does not classify opponents as threats", () => {
    const fixture = policyFixture(Difficulty.Easy, {
      requestorTroops: 10_000,
      requestorTiles: 100,
    });

    expect(
      shouldAcceptCapitulation(
        fixture.game,
        fixture.recipient,
        fixture.requestor,
      ),
    ).toBe(false);
  });

  test("Medium accepts only when troop and territory dominance thresholds are both met", () => {
    const troopDominantOnly = policyFixture(Difficulty.Medium, {
      requestorTroops: 1_000,
      requestorTiles: 20,
    });
    const dominant = policyFixture(Difficulty.Medium, {
      requestorTroops: 501,
      requestorTiles: 21,
    });

    expect(
      shouldAcceptCapitulation(
        troopDominantOnly.game,
        troopDominantOnly.recipient,
        troopDominantOnly.requestor,
      ),
    ).toBe(false);
    expect(
      shouldAcceptCapitulation(
        dominant.game,
        dominant.recipient,
        dominant.requestor,
      ),
    ).toBe(true);
  });

  test("Hard difficulty uses its max-troop threat threshold", () => {
    const belowThreat = policyFixture(Difficulty.Hard, {
      requestorTiles: 10,
      requestorMaxTroops: 2_000,
    });
    const threat = policyFixture(Difficulty.Hard, {
      requestorTiles: 10,
      requestorMaxTroops: 2_001,
    });

    expect(
      isAlliancePartnerThreat(
        belowThreat.game,
        belowThreat.recipient,
        belowThreat.requestor,
      ),
    ).toBe(false);
    expect(
      isAlliancePartnerThreat(threat.game, threat.recipient, threat.requestor),
    ).toBe(true);
  });

  test("Impossible difficulty uses troop, max-troop, or territorial threats", () => {
    const noThreat = policyFixture(Difficulty.Impossible, {
      requestorTroops: 100,
      recipientTroops: 100,
      requestorTiles: 10,
      recipientTiles: 10,
      requestorMaxTroops: 1_500,
      recipientMaxTroops: 1_000,
    });
    const maxTroopThreat = policyFixture(Difficulty.Impossible, {
      requestorTroops: 101,
      recipientTroops: 100,
      requestorTiles: 10,
      recipientTiles: 10,
      requestorMaxTroops: 1_501,
      recipientMaxTroops: 1_000,
    });
    const territorialThreat = policyFixture(Difficulty.Impossible, {
      requestorTroops: 101,
      recipientTroops: 100,
      requestorTiles: 16,
      recipientTiles: 10,
      requestorMaxTroops: 1_000,
      recipientMaxTroops: 1_000,
    });

    expect(
      isAlliancePartnerThreat(
        noThreat.game,
        noThreat.recipient,
        noThreat.requestor,
      ),
    ).toBe(false);
    expect(
      isAlliancePartnerThreat(
        maxTroopThreat.game,
        maxTroopThreat.recipient,
        maxTroopThreat.requestor,
      ),
    ).toBe(true);
    expect(
      isAlliancePartnerThreat(
        territorialThreat.game,
        territorialThreat.recipient,
        territorialThreat.requestor,
      ),
    ).toBe(true);
  });

  test("Impossible accepts capitulation only after both dominance thresholds", () => {
    const fixture = policyFixture(Difficulty.Impossible, {
      requestorTroops: 501,
      requestorTiles: 21,
    });

    expect(
      shouldAcceptCapitulation(
        fixture.game,
        fixture.recipient,
        fixture.requestor,
      ),
    ).toBe(true);
  });

  test("Hard difficulty rejects a dominant requester with too many alliances", () => {
    const fixture = policyFixture(Difficulty.Hard, {
      requestorAlliances: 1,
    });

    expect(
      shouldAcceptCapitulation(
        fixture.game,
        fixture.recipient,
        fixture.requestor,
      ),
    ).toBe(false);
  });
});
