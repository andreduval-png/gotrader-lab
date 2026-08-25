# INT-3A.1 Signal and Activate Market

Current Read carries the full canonical candidate set and conflict. Its active
candidate, strategy, and geometry IDs are populated only from the unified
set's singular selected candidate. Conflict uses a strategy-disagreement
narrative, not a mixed-timeframe narrative.

The signal contract represents conflict as `no_signal`/flat plus explicit
conflict metadata. It clears strategy, candidate, geometry, entry, stop,
target, R:R, and actionability.

Activate Market projects every canonical candidate into `candidatePlans[]`.
During conflict the research side is flat and singular `proposedGeometry` is
unset. Compatibility fallbacks for old persisted fixtures are guarded by the
absence of candidate-set disposition; a current packet cannot use them to
choose a winner.

