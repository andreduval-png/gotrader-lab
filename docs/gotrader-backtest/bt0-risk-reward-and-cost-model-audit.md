# BT0 Risk, Reward, CFD Units, And Cost Model Audit

## R:R Implementations

| Path | Risk / reward formula | Realized R behavior | Limits |
|---|---|---|---|
| Generic outcome evaluator | `risk=max(tickSize, 0.25, abs(entry-stop))`; reward from target-entry | Target/stop/end close converted to R after selected costs | `0.25` floor is invalid as a universal CFD/forex rule |
| Generic IFVG/CMD | Absolute entry-stop and target-entry | Target/stop/expiry result adjusted by configured tick-like costs | Assumes entry at decision; units inherit static symbol table |
| ICT replay | Risk is absolute entry-reference to invalidation; target distance is absolute target-reference | `rrAchieved=MFE/risk` | Excursion is not realized R; no cost model |
| Performance helpers | Consume already-produced R | Aggregate average, PF, drawdown | Cannot repair upstream fill/unit errors |

Native strategy geometry is mainly `STRUCTURE_DEFINED` or `DYNAMIC`. Generic target multiples can be `PROFILE_CONFIGURED`; proposed sweeps would be `EXPERIMENTAL`. The future engine must retain the original entry/stop/target and label every override.

## Native Versus Standardized R:R

Both modes are recommended:

- `NATIVE_STRATEGY_GEOMETRY`: simulate the strategy's immutable entry, stop, target, and exit policy.
- `STANDARDIZED_RR_EXPERIMENT`: derive alternative targets (for example 1R, 1.5R, 2R) from the same frozen opportunity and risk distance.

Each standardized result must carry its own experiment ID, RR model/version, target derivation, and parent opportunity ID. It must not mutate the detector, native geometry, profile hash, or native result.

## CFD / Forex Unit Audit

The read-only MT5 mapping currently includes:

| Requested alias | Broker symbol | Asset interpretation |
|---|---|---|
| MNQ / NQ | USTECH | Index CFD/proxy |
| ES | US500 | Index CFD/proxy |
| YM | US30 | Index CFD/proxy |
| XAUUSD | XAUUSD | Metal spot/CFD |
| EURUSD | EURUSD.pro | Forex |
| BTCUSD | BTCUSD | Crypto CFD/proxy |

The generic backtest configuration, however, sanitizes symbols to `ES`, `NQ`, `MES`, or `MNQ`. Its static price increments include futures aliases and a few spot/CFD names, but the sanitizer prevents a coherent end-to-end use of the latter. Unknown symbols fall back to `0.25`.

GoTrader therefore does not yet consistently distinguish:

- raw price movement;
- broker point (`point`/minimum quoted increment);
- market pip convention (especially forex);
- broker tick size, where different from point;
- R, which is price P&L divided by initial price risk after costs;
- cash P&L for a chosen MT5 lot size.

BT0 does not introduce futures-contract sizing. For MT5 cash calculations, any broker-reported `trade_contract_size`, tick value, lot step, or similar symbol property is metadata for the broker's lot/cash conversion, not a CME futures contract assumption. The canonical engine should prefer broker profit-calculation APIs or versioned MT5 symbol metadata and should keep price/point/pip/R calculations valid even when cash sizing is disabled.

Digits, point, pip convention, tick size/value, lot size rules, minimum volume, and cash conversion were not live-probed under the concurrency restriction. They are `NOT_AVAILABLE` for each live broker symbol and must be captured as a versioned symbol-spec snapshot in BT1.

## Existing Cost Model

| Cost | Current support | Unit/source | Verdict |
|---|---|---|---|
| Spread | Static generic config; MT5 candles may expose row spread | Tick-like config or unnormalized MT5 integer | Partial, not broker-normalized |
| Slippage | Static generic config | Tick-like units | Scenario only, not empirical |
| Commission | Static generic round-trip amount | Converted through tick/price assumptions | Partial and ambiguous |
| Swap/financing | None | N/A | Missing |
| Gap friction | None | N/A | Missing |
| Dynamic spread | Not used in canonical replay | N/A | Missing |
| Asymmetric entry/exit friction | Partial generic handling | Price adjustment | Inconsistent by exit type |

Generic consensus entry pays approximately half-spread plus slippage; stop/market exits include slippage; target exits do not consistently include equivalent adverse exit slippage. Commission is converted once as a round-trip amount. IFVG/CMD paths aggregate configured tick-like costs against risk. ICT replay has no transaction cost.

## Historical Claim Classification

Existing reports should be read as:

- `partially adjusted` where generic configured costs or explicit stress costs are documented;
- `gross` where ICT replay has no cost model;
- `unknown` where the audit does not preserve a model ID/version and complete parameters.

Old claims must not be rewritten. A future run must report gross and net metrics side by side and identify every cost component.

## Required Cost Contract

Each run needs a versioned cost model with symbol scope, date validity, source, and units. At minimum: bid/ask or spread series/fallback, entry/exit slippage policy, commission per MT5 lot/side where applicable, financing/swap policy, gap policy, and missing-cost fail/allow behavior. Conversion should be explicit: broker points/pips -> price -> R -> optional cash P&L. No cost may be silently expressed as a generic tick.
