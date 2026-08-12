# BT1.6 Restart And Resume Report

Status: `PASSED`

BT1.6 requires the existing runner's `--interrupt-after-pages` boundary and
expected exit code 75. Report
`sha256:a434502e3182f88ca26348ae3f165c0c957d6563fdc0acfd08a4da4e00bbced4`
records the controlled interruption at page 210. Its passed GET-only audit is
`sha256:9286758bb222cd295da5854e7078771409ecca4aab8418b809cb4ff295431042`.
The later coalesced verification completed 213 pages under the same request and
dataset identity, proving safe continuation without duplicate partitions.
