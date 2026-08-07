# BT1 Symbol Normalization

Date: 2026-08-07

Schema: `gotrader-mt5-symbol-spec-bt1-v1`

## Purpose

BT1 separates the requested research symbol from the broker's MT5 symbol and
seals all unit metadata needed by later, separately authorized work.

For example, `MNQ` may request broker symbol `USTECH`. That mapping does not
claim the MT5 CFD is a futures contract or shares futures execution semantics.

## Required Fields

Every symbol snapshot contains:

- provider ID;
- requested symbol;
- broker symbol;
- decimal digits;
- point size;
- pip size;
- points per pip;
- spread unit;
- provider source fingerprint;
- verification status.

Optional provider metadata includes tick size, tick value, tick-value currency,
trade contract size, minimum/maximum lot volume, lot step, and account currency.

`tradeContractSize` is retained as MT5 provider metadata. It does not mean the
system trades futures contracts. BT1 uses points, pips, price, and lots exactly
as declared by the broker symbol specification.

## Unit Rules

The invariant is:

```text
pipSize = pointSize * pipInPoints
```

All values must be finite and positive. Digits must be an integer from 0 to 12.
Lot minimum cannot exceed lot maximum. Optional tick and lot metadata must be
positive when present.

Spread is stored either as broker points or price according to `spreadUnit`.
BT1 source candles currently preserve `spreadPoints`; no BT1 code converts
spread into P&L, fills, costs, or risk.

## Verification State

- `verified_provider_metadata`: the snapshot may be accepted when all numeric invariants pass;
- `configured_unverified`: the snapshot is preserved but blocks dataset acceptance.

The fixture uses two digits, point size `0.01`, pip size `0.1`, ten points per
pip, broker-point spread, and lot metadata. A deliberately inconsistent pip
relationship blocked as expected.

## Scope Limit

BT1 records symbol truth for historical OHLC identity and integrity only. It
does not define trade size, margin, leverage, commissions, swaps, slippage,
fills, P&L, risk, or portfolio exposure. Those belong to later architecture
and cannot be inferred from this snapshot.
