# I0 Canonical Concept Audit

## Classification Rules

`FULLY_IMPLEMENTED` requires deterministic typed facts, causal timestamps, tests, and at least one governed
consumer. `PARTIAL` means useful logic exists but identity, canonical ownership, or complete semantics are missing.
`CONCEPT_ONLY` means labels or context exist without a canonical detector. `MISSING` means no substantive source
implementation was found.

| Canonical concept | Status | Current source and limitation |
| --- | --- | --- |
| Swing highs/lows | FULLY_IMPLEMENTED | Canonical and suite helper implementations exist; duplicate ownership remains |
| Equal highs/lows | PARTIAL | Suite helper detects pools; no single V2 canonical identity across consumers |
| Buy-side/sell-side liquidity pools | FULLY_IMPLEMENTED | Typed pool and sweep facts exist, with strategy consumers |
| External/internal liquidity | PARTIAL | External targets are used; IRL/ERL taxonomy and transition identity are not canonical |
| IRL to ERL / ERL to IRL | MISSING | No complete deterministic transition model found |
| Liquidity sweep/raid/reclaim | FULLY_IMPLEMENTED | Multiple causal detectors plus LRS state-machine semantics |
| Fair value gap | FULLY_IMPLEMENTED | Canonical and suite detectors, IFVG consumers, tests |
| Inverse FVG | FULLY_IMPLEMENTED | Four executable IFVG profiles and canonical adapter coverage |
| Balanced Price Range | PARTIAL | `pdArrayHierarchy` forms BPR and source docs mention it; no complete standalone contract |
| Order block | FULLY_IMPLEMENTED | Base and Phase 2 taxonomy detectors; ownership is duplicated |
| Breaker block | PARTIAL | Classification exists; no complete standalone strategy model |
| Mitigation block | PARTIAL | Classification and narrative use exist; not a complete strategy |
| Rejection/propulsion/vacuum blocks | PARTIAL | Taxonomy/helper classifications only |
| Market structure shift | FULLY_IMPLEMENTED | Canonical structure event and multiple strategy consumers |
| CISD | FULLY_IMPLEMENTED | First-class executable strategy |
| Displacement | FULLY_IMPLEMENTED | Typed detector and core confluence input |
| Premium/discount | FULLY_IMPLEMENTED | Dealing-range facts and consumers; duplicate calculators remain |
| Dealing range/equilibrium | FULLY_IMPLEMENTED | Canonical range and equilibrium facts exist |
| OTE | PARTIAL | Model One/Power Three logic uses OTE context; registry strategy is a placeholder |
| PD array hierarchy | FULLY_IMPLEMENTED | Ranked FVG/BPR/block/open references exist as context |
| Draw on liquidity | PARTIAL | Targets and narrative fields exist; no universal canonical draw-selection contract |
| SMT divergence | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | S1 canonical engine accepted in shadow; live peers stale and peer certificates missing |
| Sessions/killzones | FULLY_IMPLEMENTED | Strategy-specific windows and session facts exist |
| ICT macro timing windows | PARTIAL | Session/news windows exist, but no complete canonical macro schedule model |
| NDOG/NWOG | MISSING | No substantive deterministic implementation found |
| TGIF setup | MISSING | No substantive deterministic implementation found |
| Consolidation/manipulation/distribution | PARTIAL | Session narrative and CMD models exist; general AMD registry entry is concept-only |
| Market-maker accumulation/distribution | PARTIAL | Grinch/consolidation semantics exist; MMBM/MMSM/MMXM are not canonical models |
| Opening-price equilibrium | FULLY_IMPLEMENTED | Sunday and 12AM open references are typed Grinch context facts |
| Liquidity void / low-resistance run | PARTIAL | Helper detectors exist; canonical identity and model ownership are incomplete |

## Causality Findings

- The replay path builds detector input from candles ending at the decision index, then evaluates future candles
  separately. This is the correct broad boundary.
- BT2-compatible strategy adapters must accept only closed-candle facts valid at the decision time. LRS explicitly
  filters by causal time and `validFrom`.
- Swing confirmation needs an explicit confirmation time. S1 uses `confirmedAtUtc`; older swing helpers infer
  pivots using right-hand candles and therefore must not be treated as known at the pivot timestamp.
- Outcome scoring uses future candles only after a candidate is frozen. Same-bar target/stop ambiguity is scored
  stop-first, which is conservative.
- Strategy geometry must come from the detector/canonical adapter. Generic replay fallbacks that synthesize target
  multiples are analysis assumptions, not native model truth, and must be labeled as such.
- Forming candles, receipt time, browser state, and UI text must never enter a canonical candidate identity.

## Canonical Ownership Decision

Future work must not add another helper set. V2 canonical facts should own swing, liquidity, displacement, FVG,
dealing-range, session, and structure identities. Legacy suite helpers remain compatibility adapters until each
consumer has parity evidence. C1/C1.1 owns narrative projection, not detector eligibility. S1 owns canonical SMT
after its operational gates pass. BT2 alone owns simulated fills, costs, expiry, and same-bar ambiguity.
