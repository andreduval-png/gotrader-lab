# INT-1 Operator Cycle Audit

The operator cycle stores the canonical `activeResearchSource.fingerprint`, so feed-hash encoding and live last-close drift do not hide a same-cycle plan. Cycle ID, symbol, and canonical source identity still prevent stale-plan matching.

Slim operator execution sets `runLlmAdvisory: false`; LLM advisory therefore cannot add the former operator-path delay. Operator state uses in-memory/session persistence and catches local-storage quota failures. Activate Market summaries also retain an in-memory current-cycle copy when storage is full.

Missing live news is passed as unavailable context. It remains `unknown` and can downgrade a candidate; it is not converted to synthetic no-risk evidence.
