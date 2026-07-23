# Track A2 Task Registry

## Enabled

| Task | Version | Trigger | Timeout | Retry | Output |
|---|---:|---|---:|---:|---|
| `runtime_health_snapshot` | 1.0.0 | `candle_closed` | 2s | 1 | Compact runtime artifact ID |
| `current_market_snapshot` | 1.0.0 | `candle_closed` | 2s | 1 | Compact source artifact ID |

These tasks are strategy-neutral health/current-source projections. They create no
evidence and make no trading recommendation.

## Registered But Disabled

| Task | Reason |
|---|---|
| `shadow_context_refresh` | Feed observation gate not passed |
| `shadow_ifvg_comparison` | Phase 3 completion gate not passed |

## Prohibited

```text
trade_intent_generation
paper_order_creation
broker_execution
readiness_promotion
evidence_creation
profile_mutation
autonomous_calibration_apply
deep_replay
walk_forward
OOS
monte_carlo
```

Adding a task requires a versioned registry change and focused tests. A proposal, LLM
response, strategy result, or stored setting cannot add a task at runtime.

All descriptors and artifacts preserve authority `none / none / none`.
