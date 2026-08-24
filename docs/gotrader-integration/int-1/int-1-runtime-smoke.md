# INT-1 Runtime Smoke

Dashboard tested at `http://127.0.0.1:4176/dashboard` on desktop `1440x900` and mobile `390x844`.

- Operator Console and Research Trade Plan render without console errors.
- Mock/ineligible source remains rejected.
- Missing canonical geometry displays `NO TRADE` and `--` for entry, stop, target, and R:R.
- Research source fingerprint is visible.
- Page has no horizontal document overflow at either viewport; mobile navigation remains intentionally scrollable.
- Focused runtime fixtures prove accepted IFVG geometry is projected unchanged through Activate Market and Current Opportunity.

No MT5 mutation, trade intent, or broker action was performed.
