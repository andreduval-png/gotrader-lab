# I2.1 Historical Dataset Qualification

Disposition: qualified for descriptive I2 baselines with source-identity warnings; baseline execution is separately deferred by concurrency.

| Field | Accepted value |
| --- | --- |
| certificate | `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193` |
| dataset | `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d` |
| checksum | `sha256:4e51534035ca982a217ba64ec4438f7c2d7d7d19c7f0c1a0b6dff57b4539a0be` |
| provider | `mt5_read_only_historical` |
| source fingerprint | `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd` |
| requested / broker symbol | `MNQ` / `USTECH` |
| interval | `2024-08-01T00:00:00.000Z` to `2026-08-01T00:00:00.000Z` |
| integrity | `accepted_with_warnings`; registry status `qualified` |
| historical time / DST | `true` / `true` |

The certificate is from the accepted BT1.6 v3 registry. `USTECH` is an MT5 CFD/proxy used under an explicit `MNQ` research alias. It is not CME NQ truth or proof of futures equivalence.

Source timeframes are 1m (705,802 bars), 1d (516), and 1w (104). Deterministic derivatives are 5m (141,392), 15m (47,155), 1h (11,799), and 4h (3,200), preserving parent identity and the certificate's alignment, calendar, normalization, and lineage policies. This covers ICT 2022's frozen 1h/15m/5m requirements and PO3's frozen 15m/5m requirements for the complete two-year interval.

Read-only safety, deterministic rematerialization, restart/resume, and stable provider requery are verified. Authority is none/none/none; production adoption is false. No provider call or second download occurred in I2.1.
