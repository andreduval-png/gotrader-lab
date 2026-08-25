# INT-3A.3 Console and Network

- Existing production browser suite console errors: 0
- Existing production browser suite request failures: 0
- Existing production browser suite HTTP errors/404s: 0
- Independent direct inspector console warnings/errors for the 4191 scenario: 0
- Blocking Operator UI failures: 0

The shared in-app browser log buffer contained two older quota-pruning warnings from `http://127.0.0.1:5173/src/lib/storage/index.ts`. They predate this proof, belong to the separate primary-tree tab, and are unrelated to the 4191 acceptance server. Classification: `DEV_TOOLING_NOISE`; blocking: no.

Authority remained `execution=none`, `broker=none`, `readinessOverride=none`.
