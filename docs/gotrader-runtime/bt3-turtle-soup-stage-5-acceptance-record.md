# BT3 Turtle Soup Stage 5 Acceptance Record

Date: 2026-08-12

BT3 Turtle Soup acceptance: `44ae07bbe3b787959927770aa61d465b538bd952`

Implementation: `ca5d6733b4428b7cb64e0f940b9d382948bc0e15`

Authorization: `941b76820e705c9f500c12381e729d48bec3c5ba`

Parent Silver Bullet Stage 4 acceptance: `91e27fd25906951f1fd0da43f4c871f9079a8a96`

## Decision

```text
ACC-BT3-TURTLE-SOUP-PARITY-STAGE-5
ACCEPTED
```

Turtle Soup Stage 5 accepted compact fixture parity for native long/short
detector geometry plus representative no-sweep and no-MSS blocked paths. The
profile remains a diagnostic control with zero audited historical candidates,
`needs_more_data` robustness, and no promotion or runtime authority.

Accepted identities:

- report: `sha256:ee7eac7d3f0c2e405695d23fa062b3b9b6dea86b0ec03592058724bb0d492b14`;
- snapshot: `sha256:039e627e1031e3723f5874dceab0d093c95c1f4db7bf85bd6098d2432e02f636`;
- short parity: `sha256:9930784ef22880757552bb9e551ae7ac9cce5507b762a2d8d40fff87f7975bd9`;
- long parity: `sha256:fcf13b2c3486451362d872670e0f63607c417e65c961ddd9bda5519951d6fae4`;
- no-sweep parity: `sha256:cd71f45b66f1b380a87264990b7e28a43773ee3f6a1f72d7ecca8e3170c71437`;
- no-MSS parity: `sha256:4795b20b70a2588314dba8c828deef086f1b1ac8910c4d272aa8edc999296af8`.

## Boundary

This is fixture parity only. CISD is the next roadmap family but is not
authorized by this record. Historical strategy simulation, performance
comparison, BT3A, analytics, search, statistics, runtime adoption, B1.3/B1.4,
readiness, Paper Demo, production, broker mutation, and execution remain
unauthorized.

```text
CISD ADAPTER UNAUTHORIZED
BT3 HISTORICAL SIMULATION UNAUTHORIZED
BT3A UNAUTHORIZED
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
