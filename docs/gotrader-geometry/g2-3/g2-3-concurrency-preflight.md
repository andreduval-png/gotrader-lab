# G2.3 Concurrency Preflight

Status: `G2_3_SAFE_WITH_RESTRICTIONS`.

- Base branch: `codex/gotrader-primary-integration-checkpoint-20260813`
- Base HEAD: `d665288ecde763d103a59387584f3cdfd16f8c95`
- Base tree: `3e01136dd8bf8836a231139c22592d1d8e0ce14d`
- The primary tree was already dirty with the accepted G2.2/operator fixes, so G2.3 was applied narrowly there rather than losing that uncommitted baseline in a clean worktree.
- Vite, the supervisor, the read-only MT5 bridge, and research MCP services were active. No long historical acceptance runner was found.
- Focused tests, typecheck, and build are safe. Heavy certified-history characterization is deferred.

