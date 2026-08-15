# Liquidity Reclaim Scalper v1 R1 Child RSS Enforcement Acceptance

Decision: accept the semantics-preserving child RSS enforcement and bounded
dataset-verification correction. Keep the full R1 experiment family blocked by
the fixed governed-evidence capacity gate.

## Accepted Identities

- Feature branch: `codex/gotrader-lrs-v1-r1-child-rss-enforcement`
- Accepted feature HEAD: `749df7be1321ad69700eb9c2188576ac90efea3d`
- Accepted feature tree: `9006c47e483246129e675b163778c43d9908c6c7`
- Slice authorization: `aee42d5e5dc1e2e19d13b164df9b909d6aa53a70`
- Child enforcement implementation: `b63cc0c2c83c32ae5a928ecce0912de68e676fc6`
- Bounded dataset verification: `d73bc6e0e8303c015ca65bec8b1cc43ee3db38bd`
- Dataset-contract correction: `f574a029253d1a2c6c83ea3270531313f265aff1`
- Acceptance: `sha256:259ad1138c01e957a767e5857508a0c20fb404851513aa3ee1fdb84cfe002ea4`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Ordered sample set: `sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`

## Operational Evidence

The isolated replacement pilot v5 completed its two earliest unique trials
after an integrity-valid intentional restart. Its controller checkpoint is
`sha256:f76b964ee9bb452a54379e4095e4ed7eb59b2c71efe78057a48daec006382664`
and its final report is
`sha256:a83182530258ffc5b9337a6721ca0cf3f57f284887bfa53ad936c686e3cd565d`.
All 245 child transitions have immutable, hash-chained telemetry. Maximum
observed child RSS was 369,848,320 bytes and governed evidence was 6,919,223
bytes. Both trial reports and BT2 ledger seals independently verified.

Failed pilots v3 and v4 remain preserved. Pilot v3 proved immediate hard-limit
enforcement at 1,231,532,032 bytes. Pilot v4 exposed and preserved the initial
bounded-verifier compatibility failure before the accepted dataset-contract
correction.

Focused R1 child-enforcement, executor, baseline, and strict typecheck checks
passed after the pilot. Before the pilot, the complete semantic matrix,
production build, and sequential 44-test browser smoke passed. Existing Rollup
large-chunk warnings remain disclosed.

## Capacity Decision

The full family is not authorized. The two-trial pilot projects approximately
577,186,390 milliseconds of runtime and 432,451,438 bytes of governed evidence
for 125 unique trials and 128 dispositions. Projected storage exceeds the fixed
134,217,728-byte limit. No family operator was started, and no resource bound,
sample, parameter, or strategy semantic was weakened.

## Authority

- Authority remains `none / none / none`.
- `researchValidated` remains `false`; `productionAdoptionAllowed` remains
  `false`.
- Adaptive search, holdout use, multiple-testing decisions, null or ablation
  studies, OOS or cold-instrument decisions, Paper Demo, runtime adoption,
  production, broker mutation, trade intent, orders, and execution remain
  unauthorized.
- Any evidence-compaction or capacity correction requires a separate explicit
  authorization and a new isolated pilot root.
