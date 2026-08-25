# I1 Canonical Identity Specification

Canonical IDs are deterministic fingerprints of material source identity and versioned policy identity. Stable JSON recursively sorts object keys and excludes undefined fields. IDs never include receipt time, UI time, PID, random request identity, or process state.

Material changes to source candle IDs, market identity, anchors, policy ID, or policy version produce a different ID. State transitions do not rewrite the origin identity: consumption, fill, inversion, breaker conversion, and supersession are timestamped or represented by linked transition facts.

Lineage stores candle IDs, fact IDs, a source fingerprint, policy ID, and policy version. It never stores raw candle arrays. The current in-process fingerprint is `fnv1a128`; persistence boundaries may later wrap it in a stronger digest without changing logical identity fields.
