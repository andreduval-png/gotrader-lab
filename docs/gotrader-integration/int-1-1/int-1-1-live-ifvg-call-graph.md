# INT-1.1 Live IFVG v3 Call Graph

| Hop | Input | Output | Geometry before fix | Identity |
| --- | --- | --- | --- | --- |
| `evaluateIctIfvg` | `IctIfvgInput` candles/source | `IctIfvgCandidate` | native entry/stop/target only | producer `candidateId`, source, `ifvg_v1` retained |
| `assessIctIfvgFreshRetestV3` | input + candidate | `IctIfvgFreshRetestV3Assessment` | **undefined** | v3 assessment ID retained; canonical profile absent |
| `compactIctIfvgFreshRetestV3Assessment` | v3 assessment | compact assessment | copied only if present | candidate/source/v3 retained |
| advisor packet | compact assessment | `IctAdvisorPacket` | unavailable | compact identity retained |
| `detectCurrentOpportunities` | current context | `CurrentOpportunityScan` | unavailable, therefore near miss | v3 strategy/candidate retained |
| Current Read | advisor packet + scan | `IctCurrentRead` | projection only | candidate geometry identity retained when present |
| signal contract | Current Read | `IctResearchSignal` | projection only | canonical geometry ID retained when present |
| Activate Market | Current Read | activation summary | `matchingCandidate.geometry` only | cycle/source/candidate retained |
| Operator Console | activation summary | Research Plan | `proposedGeometry` only | cycle/source/candidate/geometry retained |

## Correct Attachment Point

The earliest complete boundary is `assessIctIfvgFreshRetestV3`, after `evaluateIctIfvg` has produced native direction, intended entry, distal-edge-plus-buffer stop, native liquidity target, lifecycle, candidate ID, and source identity, and after v3 has confirmed a fresh clean retest. INT-1.1 invokes the existing `adaptIfvgNativeGeometry` there. Downstream consumers remain projection-only.
