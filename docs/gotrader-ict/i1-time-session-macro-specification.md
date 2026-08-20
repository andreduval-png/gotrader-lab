# I1 Time, Session, and Macro Specification

`canonicalTime` owns accepted session and kill-zone identities. It preserves current Asia, London, New York, Asia range, London open, NY AM, NY Lunch, and NY PM windows under schedule version 1.0.0.

All windows use `America/New_York` and `IANA_TIME_ZONE`; the existing session resolver performs DST conversion. Strategies must not hand-roll DST logic.

The canonical macro contract exists, but exact macro windows are `UNRESOLVED` with an empty schedule. I1 does not invent source definitions.
