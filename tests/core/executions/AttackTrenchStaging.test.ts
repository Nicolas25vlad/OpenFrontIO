import { AttackExecution } from "../../../src/core/execution/AttackExecution";
import { PlayerInfo, PlayerType } from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

describe("trench attack staging", () => {
  test("land attacks pay the trench penalty only when every adjacent staging tile is fortified", async () => {
    const game = await setup(
      "big_plains",
      { strategicEconomy: true, infiniteTroops: true },
      [
        new PlayerInfo("attacker", PlayerType.Human, null, "attacker"),
        new PlayerInfo("defender", PlayerType.Human, null, "defender"),
      ],
    );
    const attacker = game.player("attacker");
    const defender = game.player("defender");
    const stagingTile = game.ref(99, 100);
    const targetTile = game.ref(100, 100);
    const alternateStagingTile = game.ref(100, 99);
    attacker.conquer(stagingTile);
    defender.conquer(targetTile);
    game.setTrenchLevel(stagingTile, 2);

    const landAttack = new AttackExecution(100_000, attacker, defender.id());
    landAttack.init(game, 0);
    expect((landAttack as any).attackerStagingTrenchLevel(targetTile)).toBe(2);

    attacker.conquer(alternateStagingTile);
    expect((landAttack as any).attackerStagingTrenchLevel(targetTile)).toBe(0);

    const navalAttack = new AttackExecution(
      100_000,
      attacker,
      defender.id(),
      stagingTile,
      false,
    );
    navalAttack.init(game, 0);
    expect((navalAttack as any).attackerStagingTrenchLevel(targetTile)).toBe(0);
  });
});
