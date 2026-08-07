# BT1.5 Performance And Storage Report

Date: 2026-08-07

Status: `PENDING_REPRESENTATIVE_PILOT`

## Current Measurements

The 2026-08-07 concurrency preflight observed approximately 24.67 GB free disk,
3.03 GB free physical memory, and 59 percent CPU load. That was sufficient for
offline compilation and fixtures, but below the live-run minimum memory floor.

The operational runner records wall time, process CPU time, peak RSS, total
dataset-root bytes/files, page and partition counts, source bars accepted and
rejected, action, verification status, and all canonical identities. It does
not print raw candles.

## Capacity Gate

A bounded pilot must run first. Its observed source bars, total partitions,
storage bytes, and peak memory are projected over the exact 730-day target with
a safety multiplier. Full mode refuses to start unless the resulting canonical
capacity plan is `within_bounds`, matches the target interval, and passes its
integrity hash.

No representative MT5 pilot has run, so retrieval time, normalization time,
integrity/sealing time, disk throughput, full storage, and full peak memory are
not yet available. Offline fixture timings must not be used to estimate BT2
capacity.
