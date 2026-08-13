# GoTrader V2 Architecture Specification - Revision 1

> Governing status: this repository copy is the supplied Revision 1 summary, not a complete standalone specification. The accepted amendment rationale and compatibility details remain in `docs/architecture/gotrader-v2-verification-report.md`; the verified current-state baseline remains in `docs/architecture/gotrader-v2-audit.md`. Missing detail must not be inferred during migration.

This is the governing design summary.

## Accepted Changes

- Split Strategy Flow and Research Lifecycle.
- Instrument-neutral Risk Engine with MT5 CFD adapter.
- Hybrid Migration.
- Profile-scoped migration.
- Adapter-first migration.
- Separate live confluence from historical evidence.
- Strengthened identity and lineage.

## Immediate Roadmap

1. Baseline stabilization.
2. Candle Repository facade.
3. Shadow Canonical Market Context.
4. IFVG v3 canary.
5. Phased migration after parity.

This summary does not authorize a V2 runtime implementation by itself. Each phase requires a separate instruction and must satisfy the migration parity policy.
