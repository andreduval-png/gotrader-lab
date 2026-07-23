# GoTrader V2 Phase 3A.1 IFVG Lifecycle Lineage Report

## Executive Decision

Phase 3A.1 closes the detection-stage compatibility gap identified by the
original IFVG v3 shadow canary. The V2 context now preserves ordered FVG
lifecycle transitions, pre-inversion usage, and inversion distance. The
shadow adapter uses those facts to enforce the legacy unused-zone rule and
36-bar inversion horizon without importing entry, stop, target, RR, replay,
readiness, or execution behavior.

The focused candidate reaches exact detection parity. The full positive
fixture reaches `acceptable_normalized_variance` because the legacy public
detector returns one post-ranked candidate while the detection-only V2 canary
returns the complete set of valid detection-stage candidates. This variance
is accepted only when the legacy-selected candidate matches exactly and every
additional V2 candidate has proved unused lineage and a valid inversion
horizon.

```text
Phase 3A.1 implementation: complete
Detection parity: passed with documented variance
Full strategy parity: not claimed
Production adoption: none
Legacy IFVG v3 authority: retained
V2 mode: shadow only
Execution authority: none
Broker authority: none
Readiness override authority: none
```

## Branch And Baseline

- Branch: `codex/gotrader-v2-phase-3a1-ifvg-lineage`
- Baseline: `4650331 Add IFVG v3 shadow detection canary`
- Scope: additive V2 context and shadow-adapter compatibility only

## Compatibility Extension

The compact FVG fact contract now records:

- ordered lifecycle transitions beginning at `fresh`;
- each transition's closed-candle time;
- bars elapsed after FVG confirmation;
- pre-inversion usage as `unused`, `used`, `unknown`, or `not_applicable`;
- inversion distance in bars.

The fact policy and IFVG shadow contract versions were advanced to V2. Raw
candle arrays remain internal to the context engine and are not serialized in
facts, adapter artifacts, comparison reports, logs, UI state, or memory.

## Detection Policy

The IFVG v3 shadow adapter accepts an inverted FVG as a detection-stage
candidate only when:

1. lifecycle lineage is present and ordered;
2. the zone was unused before inversion;
3. inversion occurred within the legacy 36-bar horizon;
4. source, timeframe, context, and semantic identities are valid;
5. no duplicate or ambiguous semantic candidate identity exists.

The adapter fails closed:

- pre-inversion use becomes `inversion_rejected_reused`;
- inversion after 36 bars becomes `inversion_outside_horizon`;
- missing lineage becomes insufficient comparison data;
- unexplained extra candidates remain `v2_only`;
- mock/sample, source mismatch, and blocked context remain ineligible.

No trade geometry is used to manufacture detection parity.

## Comparison Policy

The comparator distinguishes candidate detection from legacy post-detection
selection.

`legacy_single_ranked_candidate_vs_v2_detection_set` is an acceptable
normalized variance only when:

- the legacy public detector returns exactly one candidate;
- that candidate has an exact semantic, directional, and temporal V2 match;
- every additional V2 candidate satisfies unused-zone lineage;
- every additional V2 candidate is inside the 36-bar horizon;
- no source, profile, context, or authority mismatch exists.

Any unexplained additional candidate remains a blocking `v2_only` result.
This policy does not authorize geometry migration or production routing.

## Canary Results

| Canary | Result |
|---|---|
| Bullish inversion | detected |
| Bearish inversion | detected |
| No-IFVG fixture | `exact_parity` |
| Positive full-context fixture | `acceptable_normalized_variance` |
| Focused matching candidate | `exact_parity` |
| Reused zone | rejected |
| Inversion outside 36 bars | rejected |
| Missing lifecycle lineage | blocked |
| Unexplained extra V2 candidate | blocked |

The direct lifecycle fixture records:

```text
fresh -> touched -> partially_filled -> filled -> inverted
bars: 0 -> 1 -> 2 -> 3 -> 4
pre-inversion usage: used
```

## Preservation Results

Frozen behavior hashes are unchanged:

- IFVG v3:
  `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2 negative control:
  `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`

There are zero production adopters of the V2 shadow adapter. Legacy strategy
routing, replay, evidence, maturity, readiness, Paper-Demo, risk, broker, and
execution behavior are unchanged.

## Validation

The following passed:

- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `npm.cmd run test:v2-displacement-fvg-facts`;
- `npm.cmd run test:v2-ifvg-shadow`;
- `npm.cmd run test:core`;
- `npm.cmd run test:strategy-baselines`;
- `npm.cmd run test:source-integrity`;
- `npm.cmd run test:provenance`;
- `npm.cmd run test:safety`;
- `npm.cmd run test:browser-smoke` (`44/44`).

The production build retains only the existing Rollup circular-chunk and
large-chunk warnings.

## Safety

Phase 3A.1 adds no:

- production detector consumer;
- entry, invalidation, target, or RR output;
- replay, walk-forward, evidence, maturity, or readiness promotion;
- Paper-Demo candidate;
- execution route or live control;
- broker mutation;
- account, order, position, or deal access;
- raw candle persistence.

All new contracts retain:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Rollback

The extension is additive and shadow-only. Rollback requires reverting the V2
FVG lineage fields, the IFVG shadow policy updates, focused tests, and this
report. No production data or state migration is required.

## Phase 3B Recommendation

Phase 3B may begin as a separate shadow canary for fresh-retest and trade
geometry parity. It should:

1. compare entry-zone, invalidation, target, and RR geometry against legacy;
2. preserve causal closed-candle timing and source identity;
3. keep legacy IFVG v3 authoritative;
4. prohibit evidence, readiness, Paper-Demo, or production adoption;
5. require exact geometry parity or an explicitly documented variance before
   any later migration gate is considered.

## Final Status

```text
PHASE 3A DETECTION PARITY PASSED WITH DOCUMENTED VARIANCE
PHASE 3B GEOMETRY CANARY READY
LEGACY IFVG V3 REMAINS AUTHORITATIVE
V2 SHADOW ONLY
NO PRODUCTION ADOPTION
NO EXECUTION OR READINESS AUTHORITY
```
