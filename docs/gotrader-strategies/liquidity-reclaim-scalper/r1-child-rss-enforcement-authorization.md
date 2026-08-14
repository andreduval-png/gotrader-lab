# R1 Child RSS Enforcement Correction Authorization

Date: 2026-08-14

## Parent identity

- Parent commit: `cdd7dfdeb1decb9e7b9c99aaa32252f0eaf1fcc2`
- Branch: `codex/gotrader-lrs-v1-r1-child-rss-enforcement`
- Strategy: `liquidity_reclaim_scalper_v1`

## Authorized correction

The user explicitly authorized a semantics-preserving correction to the bounded R1 executor after replacement capacity pilot v2 exceeded the fixed 1 GiB child RSS gate.

This slice may:

- enforce the existing RSS bound immediately after every child process;
- retain soft-limit headroom before the hard limit;
- append immutable per-child RSS, exit-reason, checkpoint, and stage telemetry;
- sample memory around expensive context-building stages;
- add focused memory, restart, integrity, and evidence-preservation tests;
- run one fresh isolated capacity pilot only after all validation and resource preflight gates pass.

## Prohibited changes

This authorization does not permit changing strategy semantics, parameters, the accepted family, sampling plan, dataset, certificate, source identity, the 1 GiB hard RSS limit, the 128 MiB governed-evidence limit, or one-child concurrency. Failed pilot v1 and v2 evidence must remain unchanged. It does not authorize the full family run, adaptive search, holdout use, Paper Demo, runtime adoption, production, broker mutation, trade intent, orders, or execution.

Authority remains execution `none`, broker `none`, and readiness override `none`. `researchValidated` and `productionAdoptionAllowed` remain false.
