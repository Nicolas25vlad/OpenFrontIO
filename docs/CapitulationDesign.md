# Capitulation

Capitulation is an explicit agreement, separate from alliance requests and
percentage peace offers.

## Terms

- Any living player allowed to send an alliance request may propose to a living
  enemy. The recipient must explicitly accept. A proposal may be rejected,
  canceled by its sender, or expire after the configured alliance request
  duration. Bots and nations do not accept capitulation automatically.
- Acceptance transfers every owned, passable land tile, including the spawn
  tile, to the proposer. This does not use percentage-peace spawn protection.
- The usual conquest gold award is applied; any gold left with the eliminated
  player and all natural/processed resource stockpiles are discarded.
- All units and structures belonging to the surrendering player are removed,
  including launched nuclear units. Incoming and outgoing attacks are canceled.
  The surrendering player loses any remaining gold after the usual conquest
  award is applied.
- Alliances involving the surrendering player end. Other pending relationship
  requests involving them are rejected. The proposer keeps unrelated
  alliances.
- The accepted request is serialized through the existing deterministic game
  update stream, and the ordinary conquest event records the elimination for
  replay, standings, and multiplayer clients.

The simulation validates both participants and the complete territory snapshot
before changing ownership. The resolved transfer, cleanup, and conquest record
then run synchronously in the game execution.

## Manual client check

1. Start a local match with two players and open the other player's panel.
2. Send a capitulation proposal; confirm its card is labeled as capitulation
   and distinct from alliance or percentage-peace offers.
3. Reject one proposal, cancel another from its sender, then accept a fresh one.
4. Confirm the accepted player's full territory, including the spawn tile, is
   owned by the proposer; units disappear, attacks stop, and both players see
   the result message.
5. Replay the match and confirm the same transfer and elimination appear.

Expected: no transfer occurs before explicit acceptance; rejection and
cancellation preserve both players' state; acceptance produces the complete
transfer and elimination on both live clients and replay.
