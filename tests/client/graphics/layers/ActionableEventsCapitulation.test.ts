import { EventBus } from "../../../../src/core/EventBus";
import { GameUpdateType } from "../../../../src/core/game/GameUpdates";

vi.mock("lit", () => ({
  html: (...parts: unknown[]) => parts,
  LitElement: class {},
}));

vi.mock("lit/decorators.js", () => ({
  customElement: () => (clazz: any) => clazz,
  query: () => () => {},
  state: () => () => {},
  property: () => () => {},
}));

vi.mock("lit/directive.js", () => ({
  DirectiveResult: class {},
}));

vi.mock("lit/directives/unsafe-html.js", () => ({
  unsafeHTML: () => {},
  UnsafeHTMLDirective: class {},
}));

import { ActionableEvents } from "../../../../src/client/hud/layers/ActionableEvents";
import { SendCapitulationIntentEvent } from "../../../../src/client/Transport";

describe("ActionableEvents capitulation feedback", () => {
  const me = {
    smallID: () => 1,
    displayName: () => "Vlad",
  };
  const other = {
    smallID: () => 2,
    displayName: () => "Rival",
    isAlliedWith: () => false,
  };

  function displayWithUpdates() {
    const actionableEvents = new ActionableEvents();
    const emittedEvents = new EventBus();
    (actionableEvents as any).game = {
      myPlayer: () => me,
      playerBySmallID: (id: number) => (id === 1 ? me : other),
      ticks: () => 50,
      config: () => ({ allianceRequestDuration: () => 60 }),
    };
    (actionableEvents as any).eventBus = emittedEvents;
    (actionableEvents as any).requestUpdate = () => {};
    return { actionableEvents, emittedEvents };
  }

  it("labels a capitulation request separately and emits explicit acceptance", () => {
    const { actionableEvents, emittedEvents } = displayWithUpdates();
    let sent: SendCapitulationIntentEvent | undefined;
    emittedEvents.on(SendCapitulationIntentEvent, (event) => (sent = event));

    (actionableEvents as any).onAllianceRequestEvent({
      type: GameUpdateType.AllianceRequest,
      requestorID: other.smallID(),
      recipientID: me.smallID(),
      createdAt: 10,
      kind: "capitulation",
    });

    const capitulationCard = (actionableEvents as any).events[0];
    const ordinaryCard = displayWithUpdates();
    (ordinaryCard.actionableEvents as any).onAllianceRequestEvent({
      type: GameUpdateType.AllianceRequest,
      requestorID: other.smallID(),
      recipientID: me.smallID(),
      createdAt: 10,
    });

    expect(capitulationCard.description).not.toBe(
      (ordinaryCard.actionableEvents as any).events[0].description,
    );
    expect(capitulationCard.buttons[1].text).not.toBe(
      (ordinaryCard.actionableEvents as any).events[0].buttons[1].text,
    );
    capitulationCard.buttons[1].action();
    expect(sent).toBeInstanceOf(SendCapitulationIntentEvent);
    expect(sent?.action).toBe("accept");
    expect(sent?.player).toBe(other);
  });

  it("removes the capitulation card once the recipient resolves it", () => {
    const { actionableEvents } = displayWithUpdates();

    (actionableEvents as any).onAllianceRequestEvent({
      type: GameUpdateType.AllianceRequest,
      requestorID: other.smallID(),
      recipientID: me.smallID(),
      createdAt: 10,
      kind: "capitulation",
    });
    (actionableEvents as any).onAllianceRequestReplyEvent({
      type: GameUpdateType.AllianceRequestReply,
      request: {
        type: GameUpdateType.AllianceRequest,
        requestorID: other.smallID(),
        recipientID: me.smallID(),
        createdAt: 10,
        kind: "capitulation",
      },
      accepted: true,
    });

    expect((actionableEvents as any).events).toHaveLength(0);
  });
});
