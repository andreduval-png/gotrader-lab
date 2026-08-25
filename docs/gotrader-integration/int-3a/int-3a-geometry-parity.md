# INT-3A Geometry Parity

Deterministic fixtures verify ICT 2022 long and short geometry and preserve the
same candidate ID, geometry ID, direction, entry, stop, target, R:R, and
strategy owner through Current Opportunity and Activate Market candidate plans.

Adversarial coverage includes entry missed, target consumed, native target
below minimum R:R, fixed-asOf future extension, same-direction simultaneous
candidates, and opposing-direction conflict.

The existing INT-1.1 IFVG end-to-end parity test remains green. No downstream
numeric reconstruction was introduced.
