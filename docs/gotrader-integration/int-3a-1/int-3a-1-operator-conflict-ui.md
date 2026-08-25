# INT-3A.1 Operator Conflict UI

Operator Console renders a concise `Conflicting canonical setups` hero with
`NO TRADE`, an explicit strategy/direction summary, and no singular hero
geometry. Individual candidate cards remain below it with their independent
entry, stop, target, R:R, candidate ID binding, and geometry ID binding.

The fixture query `?int3a1Fixture=conflict` is development-only. It exercises
the normal Operator Console snapshot and component path with opposing IFVG and
ICT 2022 plans. It cannot affect production builds or execution authority.

Browser acceptance passed at the default desktop viewport and 390x844 mobile:
the conflict state and both candidates rendered, singular hero values were
`--`, horizontal overflow was absent, and browser console error count was zero.

