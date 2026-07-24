# GoTrader GBrain G1 Sidecar Integration Report

Date: 2026-07-24

## Final Status

`GBRAIN G1 PASSED - DURABLE SIDECAR INTEGRATED`

## Integration Base

- accepted baseline branch: `codex/gotrader-infrastructure-track-a3-2`
- accepted baseline commit: `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1`
- integration branch: `codex/gotrader-gbrain-integration`
- source implementation branch: `codex/gbrain-sidecar`
- source implementation commit: `64b8a67dd4e23dc31950dbe423631001085d3e5c`
- pinned official gbrain revision: `c44cdb52b1ced1a7726c3e2be099cbba6ed25ff4`
- pinned gbrain version: `0.42.65.0`

The source commit was ported additively rather than merged wholesale. Newer A3.2
runtime, time-verification, feed, scheduler, canonical context, and IFVG canary
behavior remained authoritative.

## Persistence And Ordering

The deterministic research cycle preserves this ordering:

1. persist the immutable native `ResearchEvidenceRecord`;
2. update the native lifetime aggregate;
3. create a sanitized research-memory document;
4. queue browser transport state;
5. attempt nonblocking loopback synchronization.

Sidecar availability cannot invalidate a completed cycle. Failed transport stays
retryable, while acknowledged browser payloads are removed to prevent
`localStorage` quota growth.

The native IndexedDB evidence ledger remains authoritative. gbrain is an
advisory retrieval copy only and cannot create evidence.

## Sidecar Storage

The loopback sidecar binds to `127.0.0.1:8799` and stores data under:

```text
.gotrader/gbrain-sidecar/
  documents/
  index.json
  receipts.jsonl
  gbrain-home/.gbrain/brain.pglite/
  vendor/gbrain/
  bin/gbrain.cmd
```

Every accepted document reaches the atomic Markdown spool before indexing.
Receipts are append-only, memory IDs are stable, and duplicate delivery is
idempotent. If PGLite is unavailable, bounded spool keyword search remains
available.

## Setup And Recovery

Supported commands:

```powershell
npm.cmd run gbrain:setup -- --install
npm.cmd run gbrain:sidecar
npm.cmd run gbrain:status
npm.cmd run gbrain:sync
```

Setup now handles an existing `git clone --no-checkout` repository correctly.
The pinned checkout, Bun dependencies, local command wrapper, isolated PGLite
brain, and keyword-only policy are idempotently restored.

The standard local stack starts and monitors the sidecar as an optional service.
Sidecar failure degrades memory retrieval only; market data and deterministic
research remain independent.

## Browser And UI Behavior

- Operator Console shows durable, indexed, and browser-queued counts.
- Self-Improvement can backfill, synchronize, and search compact memory.
- Search results remain advisory and cannot create validation-chain evidence.
- The browser caches compact status only; raw database content is never exposed.

## Safety Contract

Every sidecar response enforces:

```text
advisoryOnly: true
nativeEvidenceAuthoritative: true
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
productionAdoptionAllowed: false

executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

The sidecar rejects raw candles, OHLCV arrays, runtime snapshots, credentials,
secrets, account/order/position data, screenshots/base64, and unsafe authority.
It exposes no execution, broker, account, order, or position route.

## Verification

Passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:research-evidence-memory`
- `npm.cmd run test:gbrain-sidecar`
- `npm.cmd run test:gbrain-sidecar:real`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke` (44/44)

The real disposable-brain test proved PGLite initialization without embeddings
or API spend, capture through the pinned official gbrain CLI, keyword retrieval,
and retrieval persistence after a sidecar restart.

Frozen strategy hashes remained:

```text
IFVG v3 positive canary:
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2 negative control:
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224
```

## Known Limitations

- Retrieval is keyword-oriented and does not use embeddings.
- gbrain retrieval is advisory and is not automatically injected into
  deterministic candidate scoring.
- MCP-facing agents cannot query memory until G2 is completed.
- The local HTTP writer relies on loopback binding, origin restrictions, strict
  packet validation, and stable memory identity. No remote writer is supported.

## Rollback

Stop the optional sidecar and remove it from local-stack service registration.
The native evidence ledger, research cycles, strategy baselines, replay,
walk-forward, readiness, and execution safety remain functional without gbrain.
The ignored `.gotrader/gbrain-sidecar` directory may be retained for later
recovery.
