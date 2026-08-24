# INT-1 Branch Dependency Map

| Program | Head | Tree | Primary merged | INT-1 use | Disposition |
| --- | --- | --- | --- | --- | --- |
| Primary | `d665288` | `3e01136d` | base | yes | integration base |
| I1 facts | `46caa3c` | `0d816dc8` | no | component source | integrate minimum fact layer |
| G1.1 | `82e5c1f` | `c3983e01` | no | component source | integrate shared geometry core only |
| G2 audit | `1ce18a3` | `afb60441` | no | audit source | use findings, not branch wholesale |
| G2.1 | `7b7e912` | `5c40ccfe` | no | component source | port projection-only corrections |
| G2.2 | `42b1e2a` | `37f90d9e` | no | policy/test source | port acceptance controls |
| G2.3 | `15911d6` | `166000f4` | no | exact source | reproducible one-commit delta from primary |
| C1 | `927c462` | `108b180c` | no | audit only | verify ownership; no broad merge |
| C1.1 | `e408646` | `74c22449` | no | audit only | verify ownership; no broad merge |
| S1 SMT | `50868f5` | `1cc947ae` | no | audit only | runtime wiring must be proven separately |
| I2 | `f6a489b` | `121ed466` | no | no | later integration |
| I3 | `50c396d` | `0959dca0` | no | no | later integration |
| I4 | `d6dc071` | `9f9186fd` | no | no | later integration |
| I5 | `4560bae` | `948c9f86` | no | no | later integration |
| I6A | `c42fbd3` | `00389638` | no | no | later integration |
| I6B | `a545f8f` | `68f81b20` | no | no | later integration |
| I7 | `a5c74d5` | `76900199` | no | no | catalog only, later integration |
| BT-G1 | `e6a0494` | `544d7dfd` | no | no | deferred pending canonical primary |
| BT-G1.1 | `57e005b` | `ffca02f9` | no | no | deferred pending canonical primary |
| BT-G1.2 | `ae44151` | `ec7a9399` | no | no | deferred pending canonical primary |
| BT-G1.3R | `2bf2ddb` | `f58812c6` | no | no | deferred and resource-limited |
| Broad G2 candidate | `9e5c0fd` | `2116c75b` | no | no | superseded for INT-1; imports I2-I6 |

`G2_3_REPRODUCIBLY_FROZEN`: commit `15911d673d7f4ccafdaf8f135c766525b0c03330` has primary `d665288` as its sole parent and contains the bounded IFVG producer delta.

`BT_G1_INTEGRATION_DEFERRED_PENDING_PRIMARY_CANONICAL_BASELINE`.
