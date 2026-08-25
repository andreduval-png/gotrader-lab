# G2.2 Browser Acceptance

Disposition: `PASS WITH DETERMINISTIC FIXTURE COVERAGE`.

The exact G2.2 production build was served temporarily at `http://127.0.0.1:4182/dashboard`. The temporary server was stopped after inspection; existing services were untouched.

Observed in the actual application:

- page title `GoTrader AI Lab` and Operator Console loaded normally;
- no browser console warnings or errors;
- Research Plan card remained visible;
- with no canonical activation geometry, the card displayed `NO TRADE`;
- entry, stop, target, and theoretical R:R displayed `--`;
- card text stated that no canonical entry was available and geometry was not inferred from R:R;
- authority displayed none and the page remained research-only.

No shared browser storage was altered to fabricate live candidates. Candidate-state acceptance is therefore bound to deterministic UI/projection fixtures:

| Case | Result |
|---|---|
| Canonical actionable candidate | Exact canonical entry/stop/target/R:R projected; no reconstruction |
| Valid below-R:R | Native levels retained; `NO TRADE` |
| Source-blocked B&B/OSOK | Research-visible blocker; no prices |
| One-point MNQ/USTECH adapter stop | Rejected before downstream plan geometry |
| Entry missed | `ENTRY_MISSED`; no current-price substitution |

The actual-browser default state and deterministic candidate states together satisfy browser acceptance without mutating active operator/runtime evidence.
