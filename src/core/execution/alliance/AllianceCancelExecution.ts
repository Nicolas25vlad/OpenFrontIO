import { Execution, Game, Player, PlayerID } from "../../game/Game";

/** Removes a pending request only when the authenticated sender created it. */
export class AllianceCancelExecution implements Execution {
  private active = true;
  private recipient: Player | null = null;

  constructor(
    private readonly requestor: Player,
    private readonly recipientID: PlayerID,
  ) {}

  init(mg: Game): void {
    if (!mg.hasPlayer(this.recipientID)) {
      this.active = false;
      return;
    }
    this.recipient = mg.player(this.recipientID);
  }

  tick(): void {
    if (this.recipient === null) {
      this.active = false;
      return;
    }
    const request = this.requestor
      .outgoingAllianceRequests()
      .find((candidate) => candidate.recipient() === this.recipient);
    request?.cancel();
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
