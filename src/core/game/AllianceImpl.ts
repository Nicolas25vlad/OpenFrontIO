import { Game, MutableAlliance, Player, Tick } from "./Game";
import { GameUpdateType } from "./GameUpdates";

export const PEACE_TRUCE_DURATION_TICKS = 180 * 10;

export class AllianceImpl implements MutableAlliance {
  private extensionRequestedRequestor_: boolean = false;
  private extensionRequestedRecipient_: boolean = false;

  private expiresAt_: Tick;
  private readonly duration_: Tick;

  constructor(
    private readonly mg: Game,
    readonly requestor_: Player,
    readonly recipient_: Player,
    private readonly createdAt_: Tick,
    private readonly id_: number,
    duration = mg.config().allianceDuration(),
  ) {
    this.duration_ = duration;
    this.expiresAt_ = createdAt_ + duration;
  }

  other(player: Player): Player {
    if (this.requestor_ === player) {
      return this.recipient_;
    }
    return this.requestor_;
  }

  requestor(): Player {
    return this.requestor_;
  }

  recipient(): Player {
    return this.recipient_;
  }

  createdAt(): Tick {
    return this.createdAt_;
  }

  expire(): void {
    this.mg.expireAlliance(this);
  }

  addExtensionRequest(player: Player): void {
    if (this.requestor_ === player) {
      this.extensionRequestedRequestor_ = true;
    } else if (this.recipient_ === player) {
      this.extensionRequestedRecipient_ = true;
    }
    this.mg.addUpdate({
      type: GameUpdateType.AllianceExtension,
      playerID: player.smallID(),
      allianceID: this.id_,
    });
  }

  bothAgreedToExtend(): boolean {
    return (
      this.extensionRequestedRequestor_ && this.extensionRequestedRecipient_
    );
  }

  onlyOneAgreedToExtend(): boolean {
    // Requestor / Recipient of the original alliance request, not of the extension request
    // False if: no expiration or neither requested extension yet (both false), or both agreed to extend (both true)
    // True if: one requested extension, other didn't yet or actively ignored (one true, one false)
    return (
      this.extensionRequestedRequestor_ !== this.extensionRequestedRecipient_
    );
  }

  agreedToExtend(player: Player): boolean {
    return (
      (this.requestor_ === player && this.extensionRequestedRequestor_) ||
      (this.recipient_ === player && this.extensionRequestedRecipient_)
    );
  }

  public id(): number {
    return this.id_;
  }

  extend(): void {
    this.extensionRequestedRequestor_ = false;
    this.extensionRequestedRecipient_ = false;
    this.expiresAt_ = this.mg.ticks() + this.duration_;
  }

  expiresAt(): Tick {
    return this.expiresAt_;
  }
}
