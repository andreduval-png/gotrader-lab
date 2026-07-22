#!/usr/bin/env python3
"""Deterministic tests for the read-only terminal clock observation reader."""

from __future__ import annotations

import json
import runpy
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from v2_mt5_terminal_clock import (
    AUTHORITY,
    MAX_OBSERVATION_BYTES,
    TerminalClockObservationError,
    TerminalClockObservationRegistry,
    classify_terminal_clock,
    fnv1a32,
    observation_path,
    read_observation,
    validate_observation,
)


def expect_error(action, expected: str) -> None:
    try:
        action()
    except TerminalClockObservationError as error:
        assert expected in str(error), (expected, str(error))
        return
    raise AssertionError(f"Expected {expected}")


def fixture(*, utc_raw: int = 1_800_000_000, offset_seconds: int = 0) -> dict:
    server_raw = utc_raw + offset_seconds
    return {
        "schemaId": "gotrader-mt5-terminal-clock-observation",
        "version": "1.0.0",
        "observationId": f"ABCDEF12-100-{server_raw}",
        "sequence": 100,
        "probeInstanceId": "ABCDEF12",
        "symbol": "USTECH",
        "timeframe": "M5",
        "captureDurationMs": 2,
        "timeCurrentRaw": server_raw,
        "timeTradeServerRaw": server_raw + 1,
        "timeGmtRaw": utc_raw,
        "timeLocalRaw": utc_raw - 14_400,
        "timeGmtOffsetSeconds": 14_400,
        "timeDaylightSavingsSeconds": -3_600,
        "symbolTimeRaw": server_raw,
        "symbolTimeMscRaw": server_raw * 1000 + 250,
        "latestBarOpenRaw": server_raw - server_raw % 300,
        "latestBarIndex": 0,
        "symbolSynchronized": True,
        "tickReadSucceeded": True,
        "barReadSucceeded": True,
        "terminalBuild": 5836,
        "authority": AUTHORITY,
        **AUTHORITY,
    }


def compare(observation: dict, *, python_tick: int, python_bar: int, historical: bool = False) -> dict:
    system_ms = int(observation["timeGmtRaw"] * 1000)
    return classify_terminal_clock(
        observation=observation,
        system_utc_before_ms=system_ms,
        system_utc_after_ms=system_ms + 500,
        python_tick_raw=python_tick,
        python_tick_msc_raw=python_tick * 1000 + 250,
        python_latest_m5_bar_raw=python_bar,
        historical_dst_policy_verified=historical,
    )


valid = fixture()
validate_observation(valid)
expect_error(lambda: validate_observation({**valid, "accountData": {"login": 1}}), "sensitive_field_forbidden")
expect_error(lambda: validate_observation({**valid, "executionAuthority": "trade"}), "top_level_authority_invalid")

with tempfile.TemporaryDirectory() as directory:
    common = Path(directory) / "Common"
    data = str(Path(directory) / "Terminal" / "INSTANCE")
    path = observation_path(str(common), data)
    expect_error(
        lambda: read_observation(common_data_path=str(common), terminal_data_path=data),
        "file_missing",
    )
    path.parent.mkdir(parents=True)
    persisted = {**valid, "probeInstanceId": fnv1a32(data)}
    path.write_text(json.dumps(persisted), encoding="utf-8")
    registry = TerminalClockObservationRegistry.empty()
    loaded = read_observation(
        common_data_path=str(common),
        terminal_data_path=data,
        now_epoch_seconds=valid["timeGmtRaw"] + 1,
        registry=registry,
    )
    assert loaded["observationId"] == valid["observationId"]
    expect_error(
        lambda: read_observation(
            common_data_path=str(common),
            terminal_data_path=data,
            now_epoch_seconds=valid["timeGmtRaw"] + 1,
            registry=registry,
        ),
        "duplicate",
    )
    expect_error(
        lambda: read_observation(
            common_data_path=str(common),
            terminal_data_path=data,
            now_epoch_seconds=valid["timeGmtRaw"] + 500,
        ),
        "stale",
    )
    path.write_bytes(b"x" * (MAX_OBSERVATION_BYTES + 1))
    expect_error(
        lambda: read_observation(common_data_path=str(common), terminal_data_path=data),
        "file_size_invalid",
    )
    path.write_text("{", encoding="utf-8")
    expect_error(
        lambda: read_observation(common_data_path=str(common), terminal_data_path=data),
        "malformed",
    )
    path.write_text(json.dumps({**persisted, "schemaId": "invalid"}), encoding="utf-8")
    expect_error(
        lambda: read_observation(
            common_data_path=str(common),
            terminal_data_path=data,
            now_epoch_seconds=valid["timeGmtRaw"] + 1,
        ),
        "schema_invalid",
    )
    path.write_text(json.dumps({**persisted, "probeInstanceId": "00000000"}), encoding="utf-8")
    expect_error(
        lambda: read_observation(
            common_data_path=str(common),
            terminal_data_path=data,
            now_epoch_seconds=valid["timeGmtRaw"] + 1,
        ),
        "instance_mismatch",
    )

utc_observation = fixture(offset_seconds=0)
utc_result = compare(
    utc_observation,
    python_tick=utc_observation["symbolTimeRaw"],
    python_bar=utc_observation["latestBarOpenRaw"],
    historical=True,
)
assert utc_result["basisClassification"] == "verified_utc_epoch"
assert utc_result["phase2Eligible"] is True

wall_observation = fixture(offset_seconds=10_800)
wall_result = compare(
    wall_observation,
    python_tick=wall_observation["symbolTimeRaw"],
    python_bar=wall_observation["latestBarOpenRaw"],
)
assert wall_result["basisClassification"] == "verified_trade_server_wall_clock"
assert wall_result["currentLiveTimeBasisVerified"] is True
assert wall_result["historicalDstPolicyVerified"] is False
assert wall_result["phase2Eligible"] is False
assert wall_result["terminalObservedOffsetMinutes"] == 180

conflict_result = compare(
    wall_observation,
    python_tick=wall_observation["symbolTimeRaw"] + 600,
    python_bar=wall_observation["latestBarOpenRaw"] + 600,
)
assert conflict_result["basisClassification"] in {"insufficient_evidence", "conflicting_terminal_evidence"}
assert conflict_result["phase2Eligible"] is False

stale_quote_observation = {
    **wall_observation,
    "timeTradeServerRaw": wall_observation["timeCurrentRaw"] + 1_800,
}
stale_quote_result = compare(
    stale_quote_observation,
    python_tick=stale_quote_observation["symbolTimeRaw"],
    python_bar=stale_quote_observation["latestBarOpenRaw"],
)
assert stale_quote_result["currentLiveTimeBasisVerified"] is False
assert "terminal_quote_stale" in stale_quote_result["blockers"]

workspace = Path(__file__).resolve().parents[1]
upstream = runpy.run_path(str(workspace / "scripts" / "mt5-readonly-upstream.py"))
build_time_contract = upstream["build_time_contract"]
terminal_evidence = {
    "terminalProbeSchemaVersion": wall_observation["version"],
    "terminalProbeObservationId": wall_observation["observationId"],
    "terminalProbeCapturedAt": "2027-01-15T08:00:00Z",
    "terminalBasisClassification": wall_result["basisClassification"],
    "pythonTransportBasis": wall_result["pythonTransportBasis"],
    "terminalObservedOffsetMinutes": wall_result["terminalObservedOffsetMinutes"],
    "terminalEvidenceStatus": wall_result["terminalEvidenceStatus"],
    "timeVerificationScope": wall_result["verificationScope"],
    "currentLiveTimeBasisVerified": wall_result["currentLiveTimeBasisVerified"],
    "historicalDstPolicyVerified": wall_result["historicalDstPolicyVerified"],
    "terminalClockClassificationVersion": wall_result["classificationVersion"],
    "terminalProbeBlockers": wall_result["blockers"],
    "terminalProbeWarnings": wall_result["warnings"],
}
live_contract = build_time_contract(
    environment={},
    raw_tick_time=wall_observation["symbolTimeRaw"],
    raw_tick_time_msc=wall_observation["symbolTimeMscRaw"],
    raw_candle_time=wall_observation["latestBarOpenRaw"],
    system_time_utc=datetime.fromtimestamp(wall_observation["timeGmtRaw"], timezone.utc),
    terminal_build=5836,
    terminal_version="500.5836.28 Apr 2026",
    mt5_package_version="5.0.5735",
    terminal_evidence=terminal_evidence,
)
assert live_contract["verificationStatus"] == "observed_candidate"
assert live_contract["providerTimeBasis"] == "mt5_server_wall_clock"
assert live_contract["configurationSource"] == "provider_metadata"
assert live_contract["currentLiveTimeBasisVerified"] is True
assert live_contract["historicalDstPolicyVerified"] is False
assert live_contract["timeVerificationScope"] == "current_live"
assert live_contract["phase2Eligible"] is False

conflicting_contract = build_time_contract(
    environment={},
    raw_tick_time=wall_observation["symbolTimeRaw"],
    raw_tick_time_msc=wall_observation["symbolTimeMscRaw"],
    raw_candle_time=wall_observation["latestBarOpenRaw"],
    system_time_utc=datetime.fromtimestamp(wall_observation["timeGmtRaw"], timezone.utc),
    terminal_build=5836,
    terminal_version="500.5836.28 Apr 2026",
    mt5_package_version="5.0.5735",
    terminal_evidence={
        **terminal_evidence,
        "terminalBasisClassification": "conflicting_terminal_evidence",
        "terminalEvidenceStatus": "conflicting",
        "currentLiveTimeBasisVerified": False,
    },
)
assert conflicting_contract["verificationStatus"] == "unknown"
assert conflicting_contract["currentLiveTimeBasisVerified"] is False
assert conflicting_contract["historicalDstPolicyVerified"] is False
assert conflicting_contract["phase2Eligible"] is False

print(json.dumps({
    "status": "passed",
    "utcClassification": utc_result["basisClassification"],
    "wallClockClassification": wall_result["basisClassification"],
    "currentLiveVerified": wall_result["currentLiveTimeBasisVerified"],
    "historicalDstVerified": wall_result["historicalDstPolicyVerified"],
    "duplicateRejected": True,
    "staleRejected": True,
    "staleQuoteRejected": True,
    "oversizedRejected": True,
    "malformedRejected": True,
    "invalidSchemaRejected": True,
    "missingObservationRejected": True,
    "terminalInstanceMismatchRejected": True,
    "conflictingContractBlocked": conflicting_contract["verificationStatus"] == "unknown",
    "sensitiveFieldsRejected": True,
    "upstreamContractStatus": live_contract["verificationStatus"],
    "authority": AUTHORITY,
}, indent=2))
