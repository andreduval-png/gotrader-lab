# Stop Precedence Policy

Current deterministic precedence has one authorized source:

1. IFVG distal edge plus the existing profile buffer.
2. If absent or non-viable, fail closed.

Swept liquidity, displacement origin, and unrelated swings are not fallback stops under the accepted profile. They may not be selected because they exceed four points, improve R:R, or improve historical performance. The target remains independently selected and is never stretched.

