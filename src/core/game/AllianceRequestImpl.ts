import { AllianceRequest, Player, Tick } from "./Game";
import { GameImpl } from "./GameImpl";
import { AllianceRequestUpdate, GameUpdateType } from "./GameUpdates";

export class AllianceRequestImpl implements AllianceRequest {
  private status_: "pending" | "accepted" | "rejected" | "canceled" = "pending";

  constructor(
    private requestor_: Player,
    private recipient_: Player,
    private tickCreated: number,
    private territoryPercent_: number,
    private game: GameImpl,
    private kind_: "alliance" | "peace" | "capitulation" = "alliance",
  ) {}

  status(): "pending" | "accepted" | "rejected" | "canceled" {
    return this.status_;
  }

  requestor(): Player {
    return this.requestor_;
  }

  recipient(): Player {
    return this.recipient_;
  }

  createdAt(): Tick {
    return this.tickCreated;
  }

  territoryPercent(): number {
    return this.territoryPercent_;
  }

  kind(): "alliance" | "peace" | "capitulation" {
    return this.kind_;
  }

  accept(): void {
    if (this.status_ !== "pending") return;
    this.status_ = this.game.acceptAllianceRequest(this)
      ? "accepted"
      : "rejected";
  }
  reject(): void {
    if (this.status_ !== "pending") return;
    this.status_ = "rejected";
    this.game.rejectAllianceRequest(this);
  }
  cancel(): void {
    if (this.status_ !== "pending") return;
    this.status_ = "canceled";
    this.game.cancelAllianceRequest(this);
  }

  toUpdate(): AllianceRequestUpdate {
    return {
      type: GameUpdateType.AllianceRequest,
      requestorID: this.requestor_.smallID(),
      recipientID: this.recipient_.smallID(),
      createdAt: this.tickCreated,
      territoryPercent: this.territoryPercent_,
      ...(this.kind_ === "alliance" ? {} : { kind: this.kind_ }),
    };
  }
}
