import {
  AllianceRequest,
  Execution,
  Game,
  Player,
  PlayerID,
} from "../../game/Game";

export type CapitulationAction = "propose" | "accept" | "reject" | "cancel";

/** Explicit capitulation consent; this execution never auto-accepts. */
export class CapitulationExecution implements Execution {
  private active = false;
  private game: Game;
  private request: AllianceRequest | null = null;

  constructor(
    private readonly actor: Player,
    private readonly action: CapitulationAction,
    private readonly otherID: PlayerID,
  ) {}

  init(mg: Game): void {
    this.game = mg;
    if (!mg.hasPlayer(this.otherID)) {
      this.active = false;
      return;
    }
    const other = mg.player(this.otherID);
    switch (this.action) {
      case "propose":
        if (
          this.actor.canSendAllianceRequest(other) &&
          !this.actor
            .incomingAllianceRequests()
            .some((request) => request.requestor() === other)
        ) {
          this.request = this.actor.createAllianceRequest(
            other,
            0,
            "capitulation",
          );
        }
        this.active = this.request !== null;
        break;
      case "accept": {
        const request = this.actor
          .incomingAllianceRequests()
          .find(
            (candidate) =>
              candidate.requestor() === other &&
              candidate.kind() === "capitulation",
          );
        request?.accept();
        break;
      }
      case "reject": {
        const request = this.actor
          .incomingAllianceRequests()
          .find(
            (candidate) =>
              candidate.requestor() === other &&
              candidate.kind() === "capitulation",
          );
        request?.reject();
        break;
      }
      case "cancel": {
        const request = this.actor
          .outgoingAllianceRequests()
          .find(
            (candidate) =>
              candidate.recipient() === other &&
              candidate.kind() === "capitulation",
          );
        request?.cancel();
        break;
      }
    }
  }

  tick(): void {
    if (this.request === null) return;
    if (this.request.status() !== "pending") {
      this.active = false;
      return;
    }
    if (
      this.game.ticks() - this.request.createdAt() >
      this.game.config().allianceRequestDuration()
    ) {
      this.request.reject();
      this.active = false;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
