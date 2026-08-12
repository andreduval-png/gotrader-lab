# BT1.6 Dataset Certificate

Status: `ISSUED_AND_REGISTERED`

Certificate ID: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`

Registry ID: `sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb`

Dataset ID: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`

The canonical certificate is an integrity-hashed JSON artifact under the
isolated `.gotrader/bt1-6` root. This Markdown record is only a summary.

The implemented builder refuses a certificate unless the full dataset,
historical time/DST, integrity, capacity, controlled resume, deterministic
rematerialization, stable provider requery, GET-only loopback safety, strategy
neutrality, and authority checks all pass. The registry stores compact IDs and
metadata only; raw candles remain in immutable BT1 storage and out of Git.

The qualified entry covers `MNQ` through broker symbol `USTECH` for the
half-open range `2024-08-01T00:00:00.000Z` through
`2026-08-01T00:00:00.000Z`. M1, D1, and W1 are native; M5, M15, H1, and H4
are derived. Historical time and DST are verified, provider drift was not
detected, read-only safety passed, and authority remains `none / none / none`.
