# BT1.6 Dataset Certificate

Status: `NOT_ISSUED`

The canonical certificate is an integrity-hashed JSON artifact under the
isolated `.gotrader/bt1-6` root. This Markdown record is only a summary.

The implemented builder refuses a certificate unless the full dataset,
historical time/DST, integrity, capacity, controlled resume, deterministic
rematerialization, stable provider requery, GET-only loopback safety, strategy
neutrality, and authority checks all pass. The registry stores compact IDs and
metadata only; raw candles remain in immutable BT1 storage and out of Git.
