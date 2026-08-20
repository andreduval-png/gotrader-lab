# GoTrader Paper-Demo Gateway Compatibility Notice

Status: legacy isolated experiment, superseded as an MCP operating path on 2026-08-18.

The canonical GoTrader Research MCP does not expose Paper-Demo preparation, MT5 handoff, account-risk, broker, order, or execution tools. The command `npm.cmd run mcp:trade-proposal` is only a compatibility alias for `npm.cmd run mcp:research`; it does not start the former Paper-Demo gateway tool surface.

Legacy Paper-Demo and MT5 demo-gateway modules remain in the repository for isolated historical tests and review. They are not registered with the stack supervisor, are not consumed by the frontend, and cannot inherit authority from the Research MCP. Do not configure or operate them as part of the current MCP stack.

The current supported boundary is documented in `docs/gotrader-research-mcp.md`:

- canonical research reads and exact-identity proposal validation only;
- draft-only, approval-required calibration intents;
- operator-gated memory-delivery requests;
- no broker access, execution, Paper-Demo promotion, auto-apply, or readiness override;
- authority fixed at `none/none/none`.

Any future Paper-Demo gateway adoption requires a separately authorized implementation and security review, explicit supervisor registration, current-profile evidence tests, and documentation that replaces this compatibility notice.
