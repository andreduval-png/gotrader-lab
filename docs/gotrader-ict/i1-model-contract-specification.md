# I1 Canonical Model Contract Specification

`CanonicalIctModel` is the required I2+ contract. It declares strategy/version identity, research classification, required/preferred/optional timeframes, required canonical fact types, explicit fact dependency IDs, C1 narrative policy, S1 SMT policy, and a versioned parameter schema.

Detection receives facts, candles by timeframe, `asOf`, source fingerprint, and parameter fingerprint. Candidates declare IDs, market time, direction, geometry, required fact IDs, blockers, profile, and parameter/source fingerprints.

The assertion rejects incomplete identity or non-none authority. All models remain research, diagnostic, or confluence only. The contract provides no execution, broker, readiness override, calibration, evidence approval, or trade-intent capability.
