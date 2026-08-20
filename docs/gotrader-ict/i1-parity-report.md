# I1 Parity Report

Date: 2026-08-20. Classification: `SEMANTICS_PRESERVED` with `EXPECTED_IDENTITY_WRAPPER_ONLY` available for later adapters.

Six frozen controls passed unchanged: IFVG, Silver Bullet, Turtle Soup, CISD, CMD High Displacement v2, and Nasdaq London Raid. Their production source imports were not migrated in I1, so candidate count, candidate ID, direction, market timestamp, entry, stop, target, blockers, profile ID, parameter hash, and source fingerprint remain legacy-baseline values.

C1 multi-timeframe and Current Read tests passed. S1 canonical (16 checks) and index-SMT tests passed in its accepted worktree. BT2 contracts, simulator, restart, and stage-2 shadow tests passed; future-source rejection and future-append invariance remained true.

The new canonical fixture passed swing causality, FVG lifecycle lineage, blocks, range/PD traceability, sessions, draw selection, compact lineage, all-none authority, and byte-equivalent future-extension behavior at fixed `asOf`.

No candidate, geometry, blocker, profile, parameter hash, source fingerprint, or frozen evidence hash changed. Limitation: this is additive shadow parity, not full strategy migration parity; adapters must be activated one strategy at a time in later governed work.

The initial broad `core` and `strategy-baselines` wrappers stopped at `ifvg-v3-positive-canary.snapshot.json` because the checkout used CRLF while the serializer emits LF. With a temporary LF-normalized working copy, snapshot generation passed byte-stably with the preserved hashes; the files were restored without content changes. The broader core suite then reached an unrelated Paper Demo harness failure: `gotrader-paper-demo-gateway-core.mjs` imports a missing `loadPaperSizingPreviewPolicy` export. I1 does not touch that path. The manifest and six semantic strategy controls passed; neither infrastructure condition is classified as `UNEXPECTED_REGRESSION` for I1.
