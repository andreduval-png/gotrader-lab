# INT-2 Post-Merge Tree Audit

The merge tree equals the accepted INT-1.1 tree:
`62e1eaf05a0a3b0a1f121f157b8c4561deeb6485`.

Static acceptance:

- downstream calls to `buildCanonicalTradeGeometry`: 0
- downstream current/latest-close price reconstruction: 0
- live IFVG v3 canonical adapter invocation: 1 production call
- stop widening: 0
- low-R:R target stretching: 0
- source-to-merge product differences: 0

The only post-merge source adjustment is a test-harness dependency entry and
alias stubs in `scripts/test-ict-index-smt.mjs`; runtime product semantics are
unchanged.
