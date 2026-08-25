# INT-3A.2 Production E2E Design

Acceptance URL: `http://127.0.0.1:4192/dashboard?acceptanceScenario=int3a2-live-conflict`

Runtime chain observed:

1. Controlled ES candles and canonical ICT facts.
2. `assessIctIfvgFreshRetestV3` and its real `adaptIfvgNativeGeometry` call.
3. `evaluateIct2022Model` and G1.1 canonical geometry.
4. Real Current Read, `detectCurrentOpportunities`, and `buildCanonicalRuntimeCandidateSet`.
5. Real signal-contract builder.
6. Real Activate Market pipeline.
7. Real `buildOperatorConsoleSnapshot`.
8. Normal `OperatorConsoleView` rendering.

The acceptance mode dynamically selects upstream controlled inputs in `operatorConsoleStore`. It does not replace Current Read, opportunity, conflict, candidate plans, research plan, signal, geometry, or the final Operator snapshot.
