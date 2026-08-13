# GoTrader V2 Golden Fixture Policy

## Definition

A golden fixture is a compact, reviewed behavioral reference. A strategy name, historical report, or catalog entry alone is not golden.

Each fixture records strategy/profile/detector identity, source provider and fingerprint when actually available, requested and broker symbols, timeframe set, market-data window, last closed candle, source commit, parameter fingerprint when known, cost model, result and lifecycle states, blockers, trade geometry when applicable, replay/OOS summaries when supported, provenance notes, and authority.

## Data rules

Fixtures must not contain credentials, secrets, account information, orders, positions, screenshots/base64, raw runtime snapshots, or unnecessary candle arrays. Detector inputs are bounded and generated in the test harness; snapshots contain compact expected outputs only.

An unavailable source fingerprint is stored as `null` with a provenance note. It must never be invented from an unrelated run.

## Normalization

`normalizeBaselineSnapshot`:

- removes run-local timestamps and random run IDs;
- preserves market timestamps and source fingerprints;
- converts machine-specific path separators;
- recursively sorts object keys;
- preserves blockers, identity, prices, RR, replay metrics, provenance, and authority;
- emits `gotrader-v2-normalized-snapshot-v1` using canonical JSON with one terminal newline.

The generator runs twice in memory and requires byte-identical output. `baseline-snapshot-hashes.json` records SHA-256 hashes.

## Review and updates

A fixture changes only after classifying the difference as an intentional behavior change, correcting a stale fixture, or accepting a reviewed migration result. Snapshot updates must not be used to conceal regression. Threshold or detector changes require a separate product instruction, not Phase 0 maintenance.
