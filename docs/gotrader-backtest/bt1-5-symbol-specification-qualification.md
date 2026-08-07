# BT1.5 Symbol Specification Qualification

Date: 2026-08-07

Status: `PENDING_LIVE_PROVIDER_METADATA`

## Intended Mapping

```text
requestedSymbol: MNQ
brokerSymbol: USTECH
semantics: research_alias_only_no_futures_equivalence
```

`MNQ` is only a stable GoTrader research alias for the broker's `USTECH` CFD.
It does not mean that the MT5 instrument is a futures contract and does not
import futures tick, multiplier, expiry, margin, or execution semantics.

## Pending Fields

The live qualification must seal provider-observed digits, point size, pip
convention, spread units, minimum price increment, tick size/value when
available, lot limits and step, provider metadata, and session behavior. MT5
prices and movement are reported in points/pips according to the sealed broker
specification; lot sizing metadata remains descriptive and grants no execution
authority.

The symbol-spec builder and canonical `symbolSpecId` are implemented and
fixture-tested, but no production broker metadata snapshot is accepted in this
report.
