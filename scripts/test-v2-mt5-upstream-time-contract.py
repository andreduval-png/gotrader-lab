#!/usr/bin/env python3

from __future__ import annotations

import json
import runpy
from datetime import datetime, timezone
from pathlib import Path


workspace = Path(__file__).resolve().parents[1]
module = runpy.run_path(str(workspace / "scripts" / "mt5-readonly-upstream.py"))
build_time_contract = module["build_time_contract"]
authority = {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}
system_time = datetime(2026, 7, 22, 18, 30, tzinfo=timezone.utc)
raw_tick = int(datetime(2026, 7, 22, 21, 29, tzinfo=timezone.utc).timestamp())
raw_candle = int(datetime(2026, 7, 22, 21, 25, tzinfo=timezone.utc).timestamp())


def observation(identifier: str, dst_state: str, offset: int, timezone_name: str | None = None) -> dict:
    return {
        "observationId": identifier,
        "observedAtUtc": "2026-01-15T14:30:00Z" if dst_state == "standard" else "2026-07-15T13:30:00Z",
        "rawProviderTime": 1768494600 if dst_state == "standard" else 1784125800,
        "normalizedProviderTimeUtc": "2026-01-15T14:30:00Z" if dst_state == "standard" else "2026-07-15T13:30:00Z",
        "systemUtc": "2026-01-15T14:30:01Z" if dst_state == "standard" else "2026-07-15T13:30:01Z",
        "appliedTimezone": timezone_name,
        "appliedOffsetMinutes": offset,
        "expectedOffsetMinutes": offset,
        "dstState": dst_state,
        "withinTolerance": True,
        "source": "historical_capture",
    }


def build(environment: dict[str, str], observations: list[dict] | None = None, candle_time: int | None = raw_candle):
    return build_time_contract(
        environment=environment,
        raw_tick_time=raw_tick,
        raw_tick_time_msc=raw_tick * 1000 + 250,
        raw_candle_time=candle_time,
        system_time_utc=system_time,
        terminal_build=5836,
        terminal_version="500.5836.28 Apr 2026",
        mt5_package_version="5.0.5735",
        observations=observations or [],
    )


terminal_evidence = {
    "terminalProbeSchemaVersion": "1.0.0",
    "terminalProbeObservationId": "ABCDEF12-100-1800010800",
    "terminalProbeInstanceId": "ABCDEF12",
    "terminalProbeCapturedAt": "2026-07-22T18:30:00Z",
    "terminalBasisClassification": "verified_trade_server_wall_clock",
    "pythonTransportBasis": "matches_symbol_quote_time",
    "terminalObservedOffsetMinutes": 180,
    "terminalEvidenceStatus": "verified_current_live",
    "timeVerificationScope": "current_live",
    "currentLiveTimeBasisVerified": True,
    "historicalDstPolicyVerified": False,
    "terminalClockClassificationVersion": "1.0.0",
    "terminalProbeBlockers": [],
    "terminalProbeWarnings": [],
}
terminal_contract = build_time_contract(
    environment={},
    raw_tick_time=raw_tick,
    raw_tick_time_msc=raw_tick * 1000 + 250,
    raw_candle_time=raw_candle,
    system_time_utc=system_time,
    terminal_build=5836,
    terminal_version="500.5836.28 Apr 2026",
    mt5_package_version="5.0.5735",
    observations=[],
    terminal_evidence=terminal_evidence,
)
assert terminal_contract["terminalProbeInstanceId"] == "ABCDEF12"
assert terminal_contract["currentLiveTimeBasisVerified"] is True


unknown = build({})
assert unknown["verificationStatus"] == "observed_candidate"
assert unknown["providerTimeBasis"] == "unknown"
assert unknown["observedOffsetMinutes"] == 179

configured = build({"MT5_PROVIDER_TIMEZONE": "Europe/Helsinki"})
assert configured["verificationStatus"] == "configured_unverified"
assert "serverTimeUtc" not in configured

seasonal = build(
    {"MT5_PROVIDER_TIMEZONE": "Europe/Helsinki"},
    [
        observation("winter", "standard", 120, "Europe/Helsinki"),
        observation("summer", "daylight", 180, "Europe/Helsinki"),
    ],
)
assert seasonal["verificationStatus"] == "verified"
assert "winter_summer_observations" in seasonal["verificationSources"]
assert seasonal["serverTimeUtc"].endswith("Z")

fixed = build(
    {
        "MT5_PROVIDER_UTC_OFFSET_MINUTES": "180",
        "MT5_PROVIDER_TIME_VERIFICATION_SOURCES": "provider_documentation",
        "MT5_PROVIDER_TIME_DECLARATION_ID": "provider-time-contract-v1",
    },
    [
        observation("fixed-1", "not_applicable", 180),
        observation("fixed-2", "not_applicable", 180),
    ],
)
assert fixed["verificationStatus"] == "verified"
assert fixed["dstPolicy"] == "fixed_offset"

invalid_timezone = build({"MT5_PROVIDER_TIMEZONE": "Mars/Olympus"})
assert invalid_timezone["verificationStatus"] == "unknown"
assert "invalid_provider_timezone" in invalid_timezone["blockers"]

invalid_offset = build({"MT5_PROVIDER_UTC_OFFSET_MINUTES": "900"})
assert invalid_offset["verificationStatus"] == "unknown"
assert "provider_utc_offset_out_of_range" in invalid_offset["blockers"]

mismatch = build(
    {
        "MT5_PROVIDER_TIMEZONE": "Europe/Helsinki",
        "MT5_PROVIDER_TIME_VERIFICATION_SOURCES": "provider_documentation",
    },
    candle_time=raw_tick - 3 * 24 * 60 * 60,
)
assert mismatch["verificationStatus"] == "configured_unverified"
assert mismatch["tickCandleBasisAgreement"] is False

serialized = json.dumps({"contracts": [unknown, configured, seasonal, fixed]})
for forbidden in ["account", "balance", "equity", "margin", "position", "order", "deal", "credential", "password", "secret", "token", "login"]:
    assert forbidden.lower() not in serialized.lower()
for contract in [unknown, configured, seasonal, fixed, invalid_timezone, invalid_offset, mismatch]:
    assert contract["authority"] == authority
    assert contract["readOnly"] is True
    assert contract["marketDataOnly"] is True

print(
    json.dumps(
        {
            "status": "passed",
            "unknownStatus": unknown["verificationStatus"],
            "configuredStatus": configured["verificationStatus"],
            "seasonalStatus": seasonal["verificationStatus"],
            "fixedStatus": fixed["verificationStatus"],
            "invalidTimezoneStatus": invalid_timezone["verificationStatus"],
            "tickCandleMismatchStatus": mismatch["verificationStatus"],
            "sensitiveFieldsAbsent": True,
            "authority": authority,
        },
        indent=2,
    )
)
