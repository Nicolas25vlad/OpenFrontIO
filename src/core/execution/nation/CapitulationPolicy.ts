import { Difficulty, Game, Player, PlayerType } from "../../game/Game";
import { assertNever } from "../../Util";

const CAPITULATION_TROOP_RATIO = 4;
const CAPITULATION_TERRITORY_RATIO = 2;

export function shouldAcceptCapitulation(
  game: Game,
  recipient: Player,
  requestor: Player,
): boolean {
  if (
    requestor.isTraitor() ||
    requestor.isFriendly(recipient) ||
    hasTooManyAlliances(game, requestor) ||
    !isAlliancePartnerThreat(game, recipient, requestor)
  ) {
    return false;
  }

  return (
    requestor.troops() >
      Math.max(1, recipient.troops()) * CAPITULATION_TROOP_RATIO &&
    requestor.numTilesOwned() >
      Math.max(1, recipient.numTilesOwned()) * CAPITULATION_TERRITORY_RATIO
  );
}

export function hasTooManyAlliances(game: Game, otherPlayer: Player): boolean {
  const { difficulty } = game.config().gameConfig();
  if (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible) {
    return false;
  }

  const totalPlayers = game
    .players()
    .filter((player) => player.type() !== PlayerType.Bot).length;
  const otherPlayerAlliances = otherPlayer.alliances().length;

  return difficulty === Difficulty.Hard
    ? otherPlayerAlliances >= totalPlayers * 0.5
    : otherPlayerAlliances >= totalPlayers * 0.25;
}

export function isAlliancePartnerThreat(
  game: Game,
  player: Player,
  otherPlayer: Player,
): boolean {
  const { difficulty } = game.config().gameConfig();
  switch (difficulty) {
    case Difficulty.Easy:
      return false;
    case Difficulty.Medium:
      return otherPlayer.troops() > player.troops() * 2.5;
    case Difficulty.Hard:
      return (
        otherPlayer.troops() > player.troops() &&
        game.config().maxTroops(otherPlayer) >
          game.config().maxTroops(player) * 2
      );
    case Difficulty.Impossible: {
      const otherHasMoreTroops = otherPlayer.troops() > player.troops() * 1.5;
      const otherHasMoreMaxTroops =
        otherPlayer.troops() > player.troops() &&
        game.config().maxTroops(otherPlayer) >
          game.config().maxTroops(player) * 1.5;
      const otherHasMoreTiles =
        otherPlayer.troops() > player.troops() &&
        otherPlayer.numTilesOwned() > player.numTilesOwned() * 1.5;
      return otherHasMoreTroops || otherHasMoreMaxTroops || otherHasMoreTiles;
    }
    default:
      return assertNever(difficulty);
  }
}
