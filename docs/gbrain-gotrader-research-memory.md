# Optional gbrain Adapter For AI-Agent Research Memory

Last updated: 2026-08-17

## Purpose

GoTrader exposes a canonical, agent-neutral research-memory contract. `garrytan/gbrain` is one optional memory/synthesis adapter, not the product name and not a trading runtime. It must not become a signal engine, chart source, readiness authority, broker authority, or execution path.

## gbrain Concepts Inspected

- The gbrain README frames the project as a "brain layer" for agents: search retrieves raw pages, while `think` synthesizes answers with citations and gap analysis.
- The README documents local and remote MCP options, including `gbrain serve` for stdio MCP and `gbrain serve --http` for HTTP MCP.
- `AGENTS.md` describes gbrain's trust boundary between trusted local CLI callers and untrusted agent-facing MCP callers.
- `INSTALL_FOR_AGENTS.md` describes PGLite as the default local brain, optional Postgres/pgvector for scale, and a setup flow that asks the operator before choosing expensive search modes.
- `src/core/operations.ts` exposes read operations such as `search`, `list_pages`, `get_links`, and graph traversal, plus mutating write operations such as tagging, links, timeline entries, raw data, and ingest logs.

## GoTrader-Native Use Cases

1. Store compact AI Research Cycle summaries so future advisory reviews can see what worked, what failed, and what remained blocked.
2. Store Walk-Forward summaries so OpenClaw can reason about recurring OOS instability without reading raw candle data.
3. Store Self-Improvement proposal summaries and before/after deltas for regression tracking.
4. Store gap-analysis packets for recurring blockers such as missing macro inputs, regime insufficiency, low sample size, or Grinch profile absence.

## Current Implementation

GoTrader has a native research-memory contract in `src/lib/researchMemory` and an authoritative append-only evidence ledger in `src/lib/researchEvidenceLedger`. Completed cycles create compact evidence records and all applicable agent-neutral memory packets. The UI exposes explicit enable and manual-send controls for the loopback-only gateway. Delivery remains disabled by default; no gbrain dependency or browser token is added.

Created packet types:

- `GoTraderResearchCycleMemory`
- `GoTraderWalkForwardMemory`
- `GoTraderSelfImprovementMemory`
- `GoTraderGapAnalysisMemory`

Created builders:

- `buildResearchEvidenceMemoryPacket(record)`
- `buildResearchEvidenceMemoryPackets(record)`

## Packet Fields

Every packet includes:

- `packetId`
- `timestamp`
- `source.provider`
- `source.requestedSymbol`
- `source.brokerSymbol` when MT5 provides broker/proxy data
- `source.candleCount`
- `regime`
- `ictThesis`
- `grinch.profile` and `grinch.blocker`
- `metrics`
- `readiness`
- `evidenceMaturity`
- `walkForwardVerdict`
- `blockers`
- `nextAction`
- `authority.executionAuthority: "none"`
- `authority.brokerAuthority: "none"`
- `authority.readinessOverrideAuthority: "none"`

## Exclusions

Research-memory packets must not contain:

- candle arrays
- raw runtime snapshots
- secrets
- account, order, or position data
- screenshots or base64 media
- imported OHLCV arrays

The packet contract records these exclusions explicitly in `exclusions` so future connectors can assert the safety boundary before writing memory.

## AI-Agent Advisory Context

Any AI agent connected through an approved local adapter may read the compact memory as advisory context. The implemented flow is:

```text
GoTrader deterministic cycle
  -> compact research-memory packet
  -> disabled-by-default local AI-agent memory outbox
  -> explicit UI enable and manual loopback delivery
  -> optional adapter indexing/search/synthesis
  -> agent advisory context
  -> GoTrader explanation/proposal review only
```

All adapter and agent outputs remain explanation-only. They cannot activate a source, pass readiness, place orders, override safety gates, or mark broker truth.

## Offline Behavior

gbrain is optional. If gbrain is missing, offline, unconfigured, or rate-limited:

- charts still render from the canonical candle source manager
- MT5 read-only still fetches candles
- AI Research Cycle can still run deterministic logic
- Walk-Forward can still use eligible canonical sources
- readiness gates still use GoTrader's own evidence, maturity, and safety logic
- OpenClaw/LLM advisory can report memory unavailable without blocking deterministic research

## Adapter Boundary

The operator supplies any adapter behind the trusted loopback endpoint. GoTrader owns packet validation, queueing, delivery state, and fail-closed authority. Adapter-specific search and synthesis remain optional and must not become a required runtime dependency.

## Safety Boundary

gbrain receives compact research summaries only. It has no execution authority, no broker authority, and no readiness override authority. GoTrader must never expose account, order, position, password, API-key, screenshot, or raw candle-array data through the research-memory packet.

See `docs/research-evidence-memory.md` for the implemented native ledger, deterministic aggregate, Self-Improvement linkage, and gbrain outbox behavior.
