"""Read-only MT5 terminal clock observation validation and correlation."""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SCHEMA_ID = "gotrader-mt5-terminal-clock-observation"
SCHEMA_VERSION = "1.0.0"
PERSISTENT_SCHEMA_VERSION = "1.1.0"
SUPPORTED_SCHEMA_VERSIONS = frozenset({SCHEMA_VERSION, PERSISTENT_SCHEMA_VERSION})
CLASSIFICATION_VERSION = "1.0.0"
MAX_OBSERVATION_BYTES = 64 * 1024
DEFAULT_MAXIMUM_AGE_SECONDS = 120
AUTHORITY = {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}
ALLOWED_FIELDS = {
    "schemaId",
    "version",
    "observationId",
    "sequence",
    "probeInstanceId",
    "symbol",
    "timeframe",
    "captureDurationMs",
    "timeCurrentRaw",
    "timeTradeServerRaw",
    "timeGmtRaw",
    "timeLocalRaw",
    "timeGmtOffsetSeconds",
    "timeDaylightSavingsSeconds",
    "symbolTimeRaw",
    "symbolTimeMscRaw",
    "latestBarOpenRaw",
    "latestBarIndex",
    "symbolSynchronized",
    "tickReadSucceeded",
    "barReadSucceeded",
    "terminalBuild",
    "authority",
    "executionAuthority",
    "brokerAuthority",
    "readinessOverrideAuthority",
    "probeVersion",
    "probeMode",
    "probeState",
    "heartbeatIntervalSeconds",
    "terminalConnected",
    "terminalDataPathFingerprint",
    "chartSymbol",
    "chartTimeframe",
}
REQUIRED_NUMERIC_FIELDS = {
    "sequence",
    "captureDurationMs",
    "timeCurrentRaw",
    "timeTradeServerRaw",
    "timeGmtRaw",
    "timeLocalRaw",
    "timeGmtOffsetSeconds",
    "timeDaylightSavingsSeconds",
    "symbolTimeRaw",
    "latestBarOpenRaw",
    "latestBarIndex",
}
SENSITIVE_TOKENS = {
    "account",
    "balance",
    "equity",
    "margin",
    "position",
    "order",
    "deal",
    "credential",
    "password",
    "secret",
    "token",
    "apikey",
    "login",
}
PERSISTENT_PROBE_STATES = frozenset({"fresh", "disconnected", "stopped"})


class TerminalClockObservationError(ValueError):
    """Raised when the diagnostic observation fails closed validation."""


def fnv1a32(value: str) -> str:
    hash_value = 2166136261
    for character in value:
        hash_value ^= ord(character)
        hash_value = (hash_value * 16777619) & 0xFFFFFFFF
    return f"{hash_value:08X}"


def observation_relative_path(terminal_data_path: str) -> Path:
    instance_id = fnv1a32(terminal_data_path)
    return Path("GoTrader") / f"gotrader-mt5-clock-probe-{instance_id}.json"


def observation_path(common_data_path: str, terminal_data_path: str) -> Path:
    files_root = (Path(common_data_path) / "Files").resolve()
    candidate = (files_root / observation_relative_path(terminal_data_path)).resolve()
    if files_root not in candidate.parents:
        raise TerminalClockObservationError("terminal_observation_path_outside_common_files")
    return candidate


def _sensitive_paths(value: Any, path: str = "observation") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            nested_path = f"{path}.{key}"
            normalized_key = str(key).replace("_", "").lower()
            if any(token in normalized_key for token in SENSITIVE_TOKENS):
                found.append(nested_path)
            found.extend(_sensitive_paths(nested, nested_path))
    elif isinstance(value, list):
        for index, nested in enumerate(value):
            found.extend(_sensitive_paths(nested, f"{path}[{index}]"))
    return found


def validate_observation(payload: Any) -> dict[str, Any]:
    blockers: list[str] = []
    if not isinstance(payload, dict):
        raise TerminalClockObservationError("terminal_observation_missing")
    for key in payload:
        if key not in ALLOWED_FIELDS:
            blockers.append(f"terminal_observation_field_forbidden:{key}")
    blockers.extend(f"terminal_observation_sensitive_field_forbidden:{path}" for path in _sensitive_paths(payload))
    if payload.get("schemaId") != SCHEMA_ID:
        blockers.append("terminal_observation_schema_invalid")
    version = payload.get("version")
    if version not in SUPPORTED_SCHEMA_VERSIONS:
        blockers.append("terminal_observation_version_invalid")
    if not str(payload.get("observationId", "")).strip():
        blockers.append("terminal_observation_id_missing")
    probe_instance = str(payload.get("probeInstanceId", ""))
    if len(probe_instance) != 8 or any(character not in "0123456789abcdefABCDEF" for character in probe_instance):
        blockers.append("terminal_probe_instance_invalid")
    if not str(payload.get("symbol", "")).strip():
        blockers.append("terminal_observation_symbol_missing")
    if payload.get("timeframe") != "M5":
        blockers.append("terminal_observation_timeframe_invalid")
    for field in REQUIRED_NUMERIC_FIELDS:
        if isinstance(payload.get(field), bool) or not isinstance(payload.get(field), (int, float)):
            blockers.append(f"terminal_observation_{field}_invalid")
    if payload.get("symbolTimeMscRaw") is not None and not isinstance(payload.get("symbolTimeMscRaw"), (int, float)):
        blockers.append("terminal_observation_symbolTimeMscRaw_invalid")
    for field in ("symbolSynchronized", "tickReadSucceeded", "barReadSucceeded"):
        if not isinstance(payload.get(field), bool):
            blockers.append(f"terminal_observation_{field}_invalid")
    if payload.get("authority") != AUTHORITY:
        blockers.append("terminal_observation_authority_invalid")
    if any(payload.get(key) != "none" for key in AUTHORITY):
        blockers.append("terminal_observation_top_level_authority_invalid")
    if version == PERSISTENT_SCHEMA_VERSION:
        if payload.get("probeVersion") != PERSISTENT_SCHEMA_VERSION:
            blockers.append("terminal_probe_version_invalid")
        if payload.get("probeMode") != "persistent_ea":
            blockers.append("terminal_probe_mode_invalid")
        probe_state = payload.get("probeState")
        if probe_state not in PERSISTENT_PROBE_STATES:
            blockers.append("terminal_probe_state_invalid")
        interval = payload.get("heartbeatIntervalSeconds")
        if isinstance(interval, bool) or not isinstance(interval, int) or interval < 10 or interval > 60:
            blockers.append("terminal_probe_interval_invalid")
        if not isinstance(payload.get("terminalConnected"), bool):
            blockers.append("terminal_connection_state_invalid")
        elif not payload["terminalConnected"] or probe_state == "disconnected":
            blockers.append("terminal_observation_disconnected")
        if probe_state == "stopped":
            blockers.append("terminal_observation_stopped")
        if payload.get("terminalDataPathFingerprint") != probe_instance:
            blockers.append("terminal_data_path_fingerprint_mismatch")
        if not str(payload.get("chartSymbol", "")).strip():
            blockers.append("terminal_chart_symbol_missing")
        if not str(payload.get("chartTimeframe", "")).strip():
            blockers.append("terminal_chart_timeframe_missing")
    if blockers:
        raise TerminalClockObservationError(",".join(sorted(set(blockers))))
    return payload


def observation_digest(observation: dict[str, Any]) -> str:
    serialized = json.dumps(
        observation,
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(serialized).hexdigest()


@dataclass
class TerminalClockObservationRegistry:
    observation_digests: dict[str, str]

    @classmethod
    def empty(cls) -> "TerminalClockObservationRegistry":
        return cls(observation_digests={})

    def accept(self, observation: dict[str, Any]) -> None:
        observation_id = str(observation["observationId"])
        digest = observation_digest(observation)
        previous_digest = self.observation_digests.get(observation_id)
        if previous_digest is not None:
            if previous_digest != digest:
                raise TerminalClockObservationError("terminal_observation_conflicting_duplicate")
            raise TerminalClockObservationError("terminal_observation_duplicate")
        self.observation_digests[observation_id] = digest


def read_observation(
    *,
    common_data_path: str,
    terminal_data_path: str,
    now_epoch_seconds: float | None = None,
    maximum_age_seconds: int = DEFAULT_MAXIMUM_AGE_SECONDS,
    expected_symbol: str | None = None,
    registry: TerminalClockObservationRegistry | None = None,
) -> dict[str, Any]:
    path = observation_path(common_data_path, terminal_data_path)
    try:
        file_size = path.stat().st_size
    except FileNotFoundError as error:
        raise TerminalClockObservationError("terminal_observation_file_missing") from error
    if file_size <= 0 or file_size > MAX_OBSERVATION_BYTES:
        raise TerminalClockObservationError("terminal_observation_file_size_invalid")
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise TerminalClockObservationError("terminal_observation_malformed") from error
    observation = validate_observation(payload)
    expected_instance = fnv1a32(terminal_data_path)
    if observation["probeInstanceId"].upper() != expected_instance:
        raise TerminalClockObservationError("terminal_probe_instance_mismatch")
    if expected_symbol is not None and observation["symbol"].upper() != expected_symbol.upper():
        raise TerminalClockObservationError("terminal_observation_symbol_mismatch")
    current_epoch = time.time() if now_epoch_seconds is None else now_epoch_seconds
    age_seconds = current_epoch - float(observation["timeGmtRaw"])
    if age_seconds < -5:
        raise TerminalClockObservationError("terminal_observation_future_timestamp")
    if age_seconds > maximum_age_seconds:
        raise TerminalClockObservationError("terminal_observation_stale")
    if registry is not None:
        registry.accept(observation)
    return observation


def classify_terminal_clock(
    *,
    observation: dict[str, Any],
    system_utc_before_ms: int,
    system_utc_after_ms: int,
    python_tick_raw: int,
    python_tick_msc_raw: int | None,
    python_latest_m5_bar_raw: int,
    wrapper_tick_raw: int | None = None,
    wrapper_latest_m5_bar_raw: int | None = None,
    maximum_observation_age_ms: int = 120_000,
    maximum_quote_age_ms: int = 120_000,
    clock_tolerance_ms: int = 5_000,
    historical_dst_policy_verified: bool = False,
) -> dict[str, Any]:
    validate_observation(observation)
    blockers: list[str] = []
    warnings: list[str] = []
    system_midpoint_ms = round((system_utc_before_ms + system_utc_after_ms) / 2)
    python_tick_ms = int(python_tick_msc_raw or python_tick_raw * 1000)
    symbol_time_ms = int(observation.get("symbolTimeMscRaw") or observation["symbolTimeRaw"] * 1000)
    deltas: dict[str, int] = {
        "pythonTickMinusTimeCurrentMs": python_tick_ms - int(observation["timeCurrentRaw"] * 1000),
        "pythonTickMinusTimeTradeServerMs": python_tick_ms - int(observation["timeTradeServerRaw"] * 1000),
        "pythonTickMinusTimeGmtMs": python_tick_ms - int(observation["timeGmtRaw"] * 1000),
        "pythonTickMinusSymbolTimeMs": python_tick_ms - symbol_time_ms,
        "pythonCandleMinusLatestM5BarMs": int((python_latest_m5_bar_raw - observation["latestBarOpenRaw"]) * 1000),
        "timeCurrentMinusTimeGmtMs": int((observation["timeCurrentRaw"] - observation["timeGmtRaw"]) * 1000),
        "timeTradeServerMinusTimeCurrentMs": int((observation["timeTradeServerRaw"] - observation["timeCurrentRaw"]) * 1000),
        "timeTradeServerMinusTimeGmtMs": int((observation["timeTradeServerRaw"] - observation["timeGmtRaw"]) * 1000),
        "symbolTimeMinusTimeGmtMs": symbol_time_ms - int(observation["timeGmtRaw"] * 1000),
        "systemUtcMinusTimeGmtMs": system_midpoint_ms - int(observation["timeGmtRaw"] * 1000),
    }
    if wrapper_tick_raw is not None:
        deltas["wrapperTickMinusPythonTickMs"] = wrapper_tick_raw * 1000 - python_tick_ms
    if wrapper_latest_m5_bar_raw is not None:
        deltas["wrapperCandleMinusPythonCandleMs"] = (wrapper_latest_m5_bar_raw - python_latest_m5_bar_raw) * 1000
    observation_age_ms = max(0, system_midpoint_ms - int(observation["timeGmtRaw"] * 1000))
    if system_utc_after_ms < system_utc_before_ms:
        blockers.append("system_capture_window_invalid")
    if system_utc_after_ms - system_utc_before_ms > 30_000:
        blockers.append("system_capture_window_too_wide")
    if observation_age_ms > maximum_observation_age_ms:
        blockers.append("terminal_observation_stale")
    if not observation["symbolSynchronized"]:
        blockers.append("terminal_symbol_not_synchronized")
    if not observation["tickReadSucceeded"]:
        blockers.append("terminal_tick_unavailable")
    if not observation["barReadSucceeded"]:
        blockers.append("terminal_bar_unavailable")
    if abs(deltas["timeTradeServerMinusTimeCurrentMs"]) > maximum_quote_age_ms:
        blockers.append("terminal_quote_stale")
    if abs(deltas["systemUtcMinusTimeGmtMs"]) > maximum_observation_age_ms:
        blockers.append("terminal_gmt_not_correlated_with_system_utc")
    if abs(deltas["pythonCandleMinusLatestM5BarMs"]) > 300_000:
        blockers.append("python_terminal_bar_basis_mismatch")

    correlation_tolerance = max(clock_tolerance_ms, observation_age_ms + clock_tolerance_ms)
    if abs(deltas["pythonTickMinusSymbolTimeMs"]) <= correlation_tolerance:
        transport_basis = "matches_symbol_quote_time"
    elif abs(deltas["pythonTickMinusTimeCurrentMs"]) <= correlation_tolerance:
        transport_basis = "matches_terminal_server_time"
    elif abs(deltas["pythonTickMinusTimeGmtMs"]) <= correlation_tolerance:
        transport_basis = "matches_utc"
    else:
        transport_basis = "unresolved"

    current_matches_quote = abs(observation["timeCurrentRaw"] * 1000 - symbol_time_ms) <= 30_000
    terminal_quote_fresh = current_matches_quote and abs(deltas["timeTradeServerMinusTimeCurrentMs"]) <= maximum_quote_age_ms
    current_offset_ms = deltas["timeCurrentMinusTimeGmtMs"]
    python_offset_ms = python_tick_ms - system_midpoint_ms
    offset_agreement = abs(current_offset_ms - python_offset_ms) <= clock_tolerance_ms + observation_age_ms
    bar_parity = abs(deltas["pythonCandleMinusLatestM5BarMs"]) <= 1_000
    if blockers:
        basis = "insufficient_evidence"
    elif transport_basis == "unresolved" or not bar_parity or not terminal_quote_fresh:
        basis = "conflicting_terminal_evidence"
        blockers.append("terminal_python_basis_conflict")
    elif abs(current_offset_ms) <= clock_tolerance_ms and abs(python_offset_ms) <= clock_tolerance_ms:
        basis = "verified_utc_epoch"
    elif current_matches_quote and offset_agreement:
        basis = "verified_trade_server_wall_clock"
    elif offset_agreement:
        basis = "current_offset_verified_only"
    else:
        basis = "verified_symbol_quote_time_basis"
        warnings.append("Python transport matches symbol quote time without a verified server-clock normalization basis.")

    current_live_verified = basis in {
        "verified_utc_epoch",
        "verified_trade_server_wall_clock",
        "current_offset_verified_only",
    }
    historical_verified = current_live_verified and historical_dst_policy_verified
    if current_live_verified and not historical_verified:
        warnings.append("Current-live MT5 time basis is verified, but historical DST policy remains unverified.")
    return {
        "classificationVersion": CLASSIFICATION_VERSION,
        "basisClassification": basis,
        "pythonTransportBasis": transport_basis,
        "terminalEvidenceStatus": (
            "verified_historical" if historical_verified else
            "verified_current_live" if current_live_verified else
            "conflicting" if basis == "conflicting_terminal_evidence" else
            "missing" if basis in {"unknown", "insufficient_evidence"} else
            "candidate"
        ),
        "verificationScope": "historical" if historical_verified else "current_live" if current_live_verified else "none",
        "currentLiveTimeBasisVerified": current_live_verified,
        "historicalDstPolicyVerified": historical_verified,
        "phase2Eligible": current_live_verified and historical_verified,
        "terminalObservedOffsetMinutes": round(current_offset_ms / 60_000) if current_live_verified else None,
        "observationAgeMs": observation_age_ms,
        "deltas": deltas,
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "authority": AUTHORITY,
    }


def compact_terminal_evidence(classification: dict[str, Any], observation: dict[str, Any]) -> dict[str, Any]:
    return {
        "terminalProbeSchemaVersion": observation["version"],
        "terminalProbeObservationId": observation["observationId"],
        "terminalProbeInstanceId": observation["probeInstanceId"],
        "terminalProbeCapturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(observation["timeGmtRaw"])),
        "terminalBasisClassification": classification["basisClassification"],
        "pythonTransportBasis": classification["pythonTransportBasis"],
        "terminalObservedOffsetMinutes": classification.get("terminalObservedOffsetMinutes"),
        "terminalEvidenceStatus": classification["terminalEvidenceStatus"],
        "timeVerificationScope": classification["verificationScope"],
        "currentLiveTimeBasisVerified": classification["currentLiveTimeBasisVerified"],
        "historicalDstPolicyVerified": classification["historicalDstPolicyVerified"],
        "terminalClockClassificationVersion": classification["classificationVersion"],
        "terminalProbeBlockers": classification["blockers"],
        "terminalProbeWarnings": classification["warnings"],
    }
