# Baseline EOL Comparison Correction Authorization

Authorized: 2026-08-14

The cycle evidence-contract validation exposed a Windows checkout-only failure:
preserved JSON fixtures are checked out with CRLF while the canonical serializer
emits LF. The semantic payload and canonical hashes are unchanged.

Authorize only comparison-time CRLF-to-LF normalization in the baseline test
harness. Do not rewrite fixtures, regenerate hashes, change strategy behavior,
or relax any content assertion.
