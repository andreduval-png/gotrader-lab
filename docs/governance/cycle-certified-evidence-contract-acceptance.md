# Cycle Certified Evidence Contract Acceptance

Accepted: 2026-08-14

## Identities

- Base integration HEAD: `fbd14782f6473f61059f07704a4e2b2825fa27a6`
- Contract authorization: `86545c289388610a836209a686bb14352c9393b0`
- Contract implementation: `362bdba308b8b6be53f67f9122644c635fe33e2b`
- Baseline EOL correction authorization: `16bffad21dcdff743b5899a53de7839632fb3d96`
- Baseline EOL correction: `cd28b118798dacc1a6b997bc8f4d12adf0c70fbd`
- Operator smoke correction authorization: `b5206198fcf1dd19b9301315f1419a6e0977abf9`
- Operator smoke correction: `e41a378bd205a514567d9be9c114a3bde6d4f361`

## Accepted Behavior

- Current canonical candles remain the sole tactical-read source.
- Historical evidence is classified as `matched_certified`,
  `matched_uncertified`, `mismatched`, or `unavailable`.
- Only `matched_certified` has `candidate_support` scope.
- Matching evidence without a certificate-bound dataset/report identity is
  profile context only.
- Mismatched or unavailable historical metrics are not fed into the cycle's
  candidate-level evidence ledger.
- The LLM packet carries the contract, evidence scope, and a strict instruction
  not to describe profile-only or mismatched history as current-candidate proof.
- The dashboard cycle card displays the historical evidence status and scope.
- No raw candles are persisted by the contract. Authority remains none/none/none.

## Validation

Passed:

- focused cycle historical-evidence contract test;
- strict TypeScript typecheck;
- research-cycle validation linkage;
- internal-agent evidence policy;
- Research Advisor stability;
- operator console snapshot;
- complete core baseline suite;
- source-integrity suite;
- provenance suite;
- safety suite;
- production build;
- sequential browser smoke, 44/44.

Preserved failures:

- Initial core run failed only because Windows checkout CRLF differed from the
  canonical LF serializer. Comparison-time normalization was separately
  authorized and passed without changing fixtures or canonical hashes.
- Initial browser run passed 43/44; the remaining assertion expected obsolete
  `Proposed entry` text while the accepted fail-closed UI renders `Entry price`.
  The separately authorized assertion correction then passed 44/44.

Existing Rollup circular-chunk and large-chunk warnings remain disclosed.

## Boundary

This acceptance does not itself attach the known two-year certificate to the
browser cycle. Until a caller supplies a complete certificate-bound report
identity matching the tactical strategy and parameters, the UI must show
profile context, mismatch, or unavailable rather than certified support.
No strategy, threshold, frozen profile, readiness authority, Paper Demo,
production, broker mutation, order, or execution state changed.
