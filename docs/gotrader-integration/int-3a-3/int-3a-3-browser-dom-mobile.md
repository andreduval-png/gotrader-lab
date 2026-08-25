# INT-3A.3 Mobile DOM Proof

Requested responsive viewport: `390x844`. The in-app browser reported a `375px` layout viewport after applying its browser chrome/device inset.

- Global `NO TRADE`: visible
- `Conflicting Canonical Setups`: visible
- Both candidate cards and geometries: accessible
- IFVG geometry: `95 / 93.9095 / 98.6 / 3.30R`
- ICT 2022 geometry: `100.5 / 105 / 89 / 2.56R`
- Hero geometry: suppressed
- `2.30R`, `High · 72%`, and `scanner pending`: absent
- Width: `scrollWidth=375`, `clientWidth=375`; no horizontal overflow

The existing Chromium production-browser suite also exercised its declared mobile viewport and passed. Screenshot: [int-3a-3-mobile.png](./int-3a-3-mobile.png)
