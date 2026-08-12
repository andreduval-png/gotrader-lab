# BT3 Stage 7 Session Raid Parity Acceptance Report

Date: 2026-08-12

Parent CISD Stage 6 acceptance: `8f687c9cf96d87852409ed86380b2eaae14ee6e8`

Authorization: `27befe1cca7afcb095e865fc4ad1bccb22778c51`

Implementation: `5b3553642cebf3af00d1b69fd2cda1394d131a67`

## Decision

```text
ACC-BT3-SESSION-RAID-PARITY-STAGE-7
ACCEPTED
```

Session Raid v1 and v2 now have compact deterministic fixture parity with the
BT2 canonical opportunity boundary. The complete v1 fixture preserves its
native short geometry and 15-minute source-close timing. No-raid and no-MSS
fixtures remain forming and emit no opportunity. The v2 default-threshold
fixture preserves filter telemetry only and cannot emit an opportunity because
the wrapper does not own independent canonical geometry.

Accepted identities:

- report: `sha256:31806046e7195833634e68fc9a04cc983f2d2ed25617897e37b4f38238905954`;
- snapshot: `sha256:4ff3df126d298a8dd3e61d0965f86cbcf007ef48fe0d20109e310ef0f9ce1a35`;
- v1 complete parity: `sha256:71d62f8c1f4120f7f232f86c4c1d026f8cd632bc8bcfb8149731211aa9a5178c`;
- v1 no-raid parity: `sha256:f9d8a701974b7b6685533a14245185309dd10bc468b9be7e96acf62491ea58cb`;
- v1 no-MSS parity: `sha256:9ac65ba1f7178ce16edcb7e6799bb258ae7d504a885df7ea712be512a495b80b`;
- v2 policy parity: `sha256:b5e512b234a195c95c688bef13b7e97d53ffd2fe0275695dbfbaa323509b7499`;
- v1 canonical opportunity: `sha256:1545359d6dbb11cb103fa80fd79bb6ab622e4cb288f9beb624c86f970cd4f648`.

Results:

- four fixtures were byte-stable across repeated generation;
- one eligible v1 fixture preserved native entry `100.75`, stop `106.77`,
  target `86`, RR `2.4502`, and 15-minute source-close timing;
- no-raid and no-MSS states emitted no opportunity;
- v2 failed the frozen default filters `weak_displacement_body` and
  `fvg_too_small`, and emitted no opportunity despite its synthetic replay
  outcome being `target_first`;
- attempts to borrow v1 geometry for v2 or rewrite either audited evidence
  boundary failed closed;
- v1 remains strict research with 12 audited candidates, 3 target-first, 9
  invalidation-first, 25% target-first, and walk-forward blocked;
- v2 remains insufficient-sample research with one retained candidate on one
  unique date and no scanner-owned geometry;
- prior frozen BT3 snapshots remained unchanged;
- no MT5 contact, raw candles, historical run, promotion, or authority was
  created.

Validation passed the native Session Raid detector suite, complete BT3 and BT2
regressions, time normalization, frozen snapshot checks, typecheck, build,
syntax, hash, and diff checks. Existing non-failing Rollup circular-chunk and
chunk-size warnings remain unchanged.

## Boundary

BT3 strategy-adapter parity is complete through Session Raid. Phase 2 remains
the next roadmap item but is separately gated and unauthorized. Historical
strategy simulation, performance comparison, BT3A, analytics, search,
statistics, runtime adoption, readiness, Paper Demo, production, broker
mutation, and execution remain unauthorized.
