# Operator Smoke Label Correction Authorization

Authorized: 2026-08-14

The browser smoke test still expected the obsolete `Proposed entry` label while
the accepted fail-closed operator view renders `Entry price`, including `--`
when no qualified plan exists. Authorize only this assertion-label correction.
Do not change trade geometry, create fallback prices, or weaken the fail-closed
operator behavior.
