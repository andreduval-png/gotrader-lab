# INT-3A.1 Cross-Family Call Graph

## Verified pre-change divergence

```text
assessIctIfvgFreshRetestV3
  -> compactIctIfvgFreshRetestV3Assessment
  -> CurrentOpportunityContext.ifvgFreshRetestV3
  -> ifvgFreshRetestV3Opportunity
  -> strategyDiagnostics
  -> CurrentOpportunity.opportunities[]

buildIctCoreRuntimeCandidates
  -> evaluateIct2022Model / evaluateIctPowerOfThree / evaluateIctJudasSwing
  -> buildIctCoreCandidateCollection
  -> CurrentOpportunityContext.coreIctCandidates
  -> coreIctOpportunities
  -> CurrentOpportunity.opportunities[]
```

Before INT-3A.1, conflict was copied only from
`CurrentOpportunityContext.coreIctCandidates.conflict`. IFVG entered the
opportunity list after that collection had already been evaluated, so an
actionable IFVG in one direction and an actionable ICT 2022 candidate in the
other direction could coexist while the global conflict remained `NONE`.

The singular selection chain then amplified the defect:

```text
Current Opportunity summarize()
  -> confidence/status sorted topOpportunity
Current Read
  -> topOpportunity ?? topNearMiss ?? topRejected
  -> activeCandidateId + canonicalGeometry
Signal contract
  -> singular side + geometry
Activate Market
  -> repeats topOpportunity ?? topNearMiss ?? topRejected
  -> proposedGeometry
Operator console
  -> singular hero research plan
```

## Corrective boundary

INT-3A.1 aggregates independently produced `CurrentOpportunity` candidates at
the canonical representation boundary. The unified set owns conflict and
singular-selection disposition. Producers and their geometries remain
unchanged.

