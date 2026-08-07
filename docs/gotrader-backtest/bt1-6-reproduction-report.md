# BT1.6 Reproduction Report

Status: `PENDING_TWO_LIVE_ROOTS`

Two independent checks are required:

- `deterministic_rematerialization` must match every governed identity;
- `provider_requery` must separately test whether MT5 returned stable history.

Provider drift is not hidden as a pipeline mismatch. During qualification it
quarantines the candidate and requires a new immutable dataset identity. The
original capture remains preserved and is never overwritten.
