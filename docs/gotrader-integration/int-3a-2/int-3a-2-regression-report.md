# INT-3A.2 Regression Report

Passed:

- `npm run test:int-3a-2-production-conflict`
- `npm run test:int-3a-1-operator-conflict`
- real IFVG/ICT cross-family scanner regression
- Activate Market multi-candidate projection regression
- `npm run typecheck`
- `npm run build`
- Playwright desktop and mobile production-path acceptance

Frozen behavior retained:

- IFVG geometry `95 / 93.9095 / 98.6` and ID unchanged.
- ICT 2022 geometry `100.5 / 105 / 89` and ID unchanged.
- same-direction candidates remain separate.
- PO3 and Judas remain non-actionable/source-blocked.
- B&B and OSOK remain source-blocked.
- no stop widening, target stretching, current-price chase, hybrid geometry, broker write, or authority expansion.
