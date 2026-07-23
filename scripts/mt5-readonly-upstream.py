#!/usr/bin/env python3
"""Minimal loopback-only MT5 market-data service for GoTrader.

The service attaches to an already authenticated MetaTrader 5 Desktop session.
It exposes symbols, quotes, and OHLCV candles only. Account, order, position,
deal, trade, and mutation routes do not exist.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import MetaTrader5 as mt5

from v2_mt5_terminal_clock import (
    TerminalClockObservationError,
    classify_terminal_clock,
    compact_terminal_evidence,
    read_observation,
)


AUTHORITY = {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}
DEFAULT_TERMINAL_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
MAX_CANDLES = 5000
MT5_LOCK = threading.Lock()
TIME_CONTRACT_ID = "gotrader-mt5-readonly-time-contract"
TIME_CONTRACT_VERSION = "1.1.0"
SERVICE_VERSION = "gotrader-mt5-readonly-upstream-v1.1"
OFFICIAL_TIME_SOURCE = "metatrader5_official_documentation"
ALLOWED_VERIFICATION_SOURCES = {
    OFFICIAL_TIME_SOURCE,
    "provider_documentation",
    "verified_terminal_metadata",
    "winter_summer_observations",
    "repeated_fixed_offset_observations",
    "tick_candle_basis_comparison",
}

TIMEFRAMES = {
    "M1": mt5.TIMEFRAME_M1,
    "M2": mt5.TIMEFRAME_M2,
    "M3": mt5.TIMEFRAME_M3,
    "M4": mt5.TIMEFRAME_M4,
    "M5": mt5.TIMEFRAME_M5,
    "M6": mt5.TIMEFRAME_M6,
    "M10": mt5.TIMEFRAME_M10,
    "M12": mt5.TIMEFRAME_M12,
    "M15": mt5.TIMEFRAME_M15,
    "M20": mt5.TIMEFRAME_M20,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H2": mt5.TIMEFRAME_H2,
    "H3": mt5.TIMEFRAME_H3,
    "H4": mt5.TIMEFRAME_H4,
    "H6": mt5.TIMEFRAME_H6,
    "H8": mt5.TIMEFRAME_H8,
    "H12": mt5.TIMEFRAME_H12,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}

BLOCKED_PATH_TOKENS = {
    "account",
    "balance",
    "deal",
    "deals",
    "execute",
    "history",
    "login",
    "order",
    "orders",
    "position",
    "positions",
    "trade",
}


def utc_iso(unix_seconds: int | float) -> str:
    return datetime.fromtimestamp(float(unix_seconds), timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    normalized = value.strip().replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def compact_candle(row: Any) -> dict[str, Any]:
    raw_time = int(row["time"])
    candle = {
        "time": utc_iso(raw_time),
        "timestamp": utc_iso(raw_time),
        "rawTime": raw_time,
        "open": float(row["open"]),
        "high": float(row["high"]),
        "low": float(row["low"]),
        "close": float(row["close"]),
        "tick_volume": int(row["tick_volume"]),
        "volume": int(row["tick_volume"]),
    }
    if "spread" in row.dtype.names:
        candle["spread"] = int(row["spread"])
    if "real_volume" in row.dtype.names:
        candle["real_volume"] = int(row["real_volume"])
    return candle


def _optional_int(value: Any) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed


def _configured_verification_sources(environment: dict[str, str]) -> list[str]:
    raw = environment.get("MT5_PROVIDER_TIME_VERIFICATION_SOURCES", "")
    sources = {item.strip() for item in raw.split(",") if item.strip() in ALLOWED_VERIFICATION_SOURCES}
    if "provider_documentation" in sources and not environment.get("MT5_PROVIDER_TIME_DECLARATION_ID", "").strip():
        sources.remove("provider_documentation")
    if "verified_terminal_metadata" in sources and not environment.get("MT5_PROVIDER_TERMINAL_METADATA_VERIFICATION_ID", "").strip():
        sources.remove("verified_terminal_metadata")
    return sorted(sources)


def load_time_verification_observations(environment: dict[str, str]) -> list[dict[str, Any]]:
    configured = environment.get("MT5_PROVIDER_TIME_OBSERVATIONS_FILE", "").strip()
    if not configured:
        return []
    path = Path(configured)
    if not path.is_file():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    observations = payload if isinstance(payload, list) else payload.get("observations", []) if isinstance(payload, dict) else []
    allowed_states = {"standard", "daylight", "not_applicable", "unknown"}
    compact: list[dict[str, Any]] = []
    for item in observations:
        if not isinstance(item, dict):
            continue
        dst_state = str(item.get("dstState", "unknown"))
        if dst_state not in allowed_states:
            dst_state = "unknown"
        compact.append(
            {
                "observationId": str(item.get("observationId", "")).strip(),
                "observedAtUtc": str(item.get("observedAtUtc", "")).strip(),
                "rawProviderTime": item.get("rawProviderTime"),
                "normalizedProviderTimeUtc": str(item.get("normalizedProviderTimeUtc", "")).strip(),
                "systemUtc": str(item.get("systemUtc", "")).strip(),
                "appliedTimezone": str(item.get("appliedTimezone", "")).strip() or None,
                "appliedOffsetMinutes": _optional_int(item.get("appliedOffsetMinutes")),
                "expectedOffsetMinutes": _optional_int(item.get("expectedOffsetMinutes")),
                "dstState": dst_state,
                "withinTolerance": item.get("withinTolerance") is True,
                "source": "historical_capture" if item.get("source") == "historical_capture" else "live",
            }
        )
    return compact


def _valid_iana_timezone(value: str | None) -> bool:
    if not value:
        return False
    try:
        ZoneInfo(value)
        return True
    except (ZoneInfoNotFoundError, ValueError):
        return False


def _wall_clock_to_utc(raw_time: int | float, timezone_name: str | None, offset_minutes: int | None) -> str | None:
    wall_clock = datetime.fromtimestamp(float(raw_time), timezone.utc).replace(tzinfo=None)
    if timezone_name:
        if not _valid_iana_timezone(timezone_name):
            return None
        return wall_clock.replace(tzinfo=ZoneInfo(timezone_name)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if offset_minutes is not None:
        return wall_clock.replace(tzinfo=timezone(timedelta(minutes=offset_minutes))).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return None


def _observation_summary(
    observations: list[dict[str, Any]],
    timezone_name: str | None,
    offset_minutes: int | None,
) -> dict[str, Any]:
    accepted = [item for item in observations if item.get("withinTolerance") is True]
    matching = [
        item
        for item in accepted
        if (timezone_name and item.get("appliedTimezone") == timezone_name)
        or (offset_minutes is not None and item.get("appliedOffsetMinutes") == offset_minutes)
    ]
    return {
        "observationCount": len(observations),
        "acceptedObservationCount": len(matching),
        "winterObservationCount": sum(item.get("dstState") == "standard" for item in matching),
        "summerObservationCount": sum(item.get("dstState") == "daylight" for item in matching),
        "fixedOffsetObservationCount": sum(item.get("dstState") == "not_applicable" for item in matching),
    }


def build_time_contract(
    *,
    environment: dict[str, str],
    raw_tick_time: int | None,
    raw_tick_time_msc: int | None,
    raw_candle_time: int | None,
    system_time_utc: datetime,
    terminal_build: int | None,
    terminal_version: str | None,
    mt5_package_version: str | None,
    observations: list[dict[str, Any]] | None = None,
    terminal_evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    configured_timezone = environment.get("MT5_PROVIDER_TIMEZONE", "").strip() or None
    configured_offset_raw = environment.get("MT5_PROVIDER_UTC_OFFSET_MINUTES", "").strip()
    configured_offset = _optional_int(configured_offset_raw)
    configured_basis = environment.get("MT5_PROVIDER_TIME_BASIS", "").strip() or None
    verification_sources = _configured_verification_sources(environment)
    provider_declaration_id = environment.get("MT5_PROVIDER_TIME_DECLARATION_ID", "").strip() or None
    terminal_metadata_verification_id = environment.get("MT5_PROVIDER_TERMINAL_METADATA_VERIFICATION_ID", "").strip() or None
    blockers: list[str] = []
    warnings: list[str] = []
    terminal_evidence = terminal_evidence or {}
    terminal_basis = terminal_evidence.get("terminalBasisClassification")
    terminal_current_live_verified = terminal_evidence.get("currentLiveTimeBasisVerified") is True
    terminal_conflicting = terminal_basis == "conflicting_terminal_evidence"

    if configured_timezone and configured_offset_raw:
        blockers.append("timezone_and_fixed_offset_are_mutually_exclusive")
    if configured_timezone and not _valid_iana_timezone(configured_timezone):
        blockers.append("invalid_provider_timezone")
    if configured_offset_raw and configured_offset is None:
        blockers.append("invalid_provider_utc_offset")
    if configured_offset is not None and not -840 <= configured_offset <= 840:
        blockers.append("provider_utc_offset_out_of_range")

    allowed_bases = {"epoch_utc", "mt5_server_wall_clock", "iso_with_offset", "unknown"}
    if configured_basis and configured_basis not in allowed_bases:
        blockers.append("invalid_provider_time_basis")
    provider_time_basis = configured_basis or (
        "mt5_server_wall_clock"
        if configured_timezone or configured_offset is not None or terminal_basis in {
            "verified_trade_server_wall_clock",
            "current_offset_verified_only",
        }
        else "epoch_utc"
        if terminal_basis == "verified_utc_epoch"
        else "unknown"
    )
    if provider_time_basis == "epoch_utc" and (configured_timezone or configured_offset is not None):
        blockers.append("epoch_utc_must_not_declare_wall_clock_timezone")
    if (
        provider_time_basis == "mt5_server_wall_clock"
        and not configured_timezone
        and configured_offset is None
        and not terminal_current_live_verified
    ):
        blockers.append("wall_clock_policy_requires_timezone_or_offset")

    dst_policy = (
        "iana_timezone_rules" if configured_timezone else "fixed_offset" if configured_offset is not None else "unknown"
    )
    configured = bool(configured_basis or configured_timezone or configured_offset_raw)
    system_epoch = system_time_utc.timestamp()
    observed_offset = None
    tick_is_recent = False
    if raw_tick_time is not None:
        observed_offset = round((float(raw_tick_time) - system_epoch) / 60)
        tick_is_recent = abs(float(raw_tick_time) - system_epoch) <= 24 * 60 * 60
    tick_candle_agreement = bool(
        raw_tick_time is not None
        and raw_candle_time is not None
        and 0 <= raw_tick_time - raw_candle_time <= 24 * 60 * 60
    )
    library_claim_agreement = bool(raw_tick_time is not None and abs(float(raw_tick_time) - system_epoch) <= 5 * 60)
    if not library_claim_agreement and raw_tick_time is not None:
        warnings.append("Observed provider time conflicts with the MetaTrader5 library UTC-time documentation claim.")

    observations = observations or []
    summary = _observation_summary(observations, configured_timezone, configured_offset)
    seasonal_verified = bool(
        configured_timezone
        and summary["winterObservationCount"] >= 1
        and summary["summerObservationCount"] >= 1
    )
    fixed_verified = bool(
        configured_offset is not None
        and summary["fixedOffsetObservationCount"] >= 2
        and "provider_documentation" in verification_sources
    )
    declared_verified = bool(
        {"provider_documentation", "verified_terminal_metadata"} & set(verification_sources)
    )
    epoch_verified = bool(
        provider_time_basis == "epoch_utc"
        and OFFICIAL_TIME_SOURCE in verification_sources
        and library_claim_agreement
        and tick_candle_agreement
    )
    wall_clock_verified = bool(
        provider_time_basis == "mt5_server_wall_clock"
        and tick_candle_agreement
        and ((configured_timezone and (seasonal_verified or declared_verified)) or fixed_verified)
    )

    if terminal_conflicting:
        warnings.append("The terminal-side clock probe conflicts with the Python MT5 timestamp basis.")
    if terminal_current_live_verified and not configured_timezone and configured_offset is None:
        warnings.append("Terminal clock evidence verifies the current-live basis only; historical DST policy remains unverified.")

    historical_dst_verified = bool(epoch_verified or wall_clock_verified)
    current_live_verified = bool(historical_dst_verified or terminal_current_live_verified)
    terminal_evidence = {
        **terminal_evidence,
        "currentLiveTimeBasisVerified": current_live_verified,
        "historicalDstPolicyVerified": historical_dst_verified,
        "timeVerificationScope": "historical" if historical_dst_verified else "current_live" if current_live_verified else "none",
    }

    if blockers:
        verification_status = "unknown"
    elif historical_dst_verified:
        verification_status = "verified"
    elif terminal_conflicting:
        verification_status = "unknown"
    elif current_live_verified:
        verification_status = "observed_candidate"
    elif configured:
        verification_status = "configured_unverified"
    elif tick_is_recent and observed_offset not in {None, 0} and tick_candle_agreement:
        verification_status = "observed_candidate"
    else:
        verification_status = "unknown"

    normalized_provider_time = None
    if raw_tick_time is not None:
        if provider_time_basis == "epoch_utc":
            normalized_provider_time = utc_iso(raw_tick_time)
        elif provider_time_basis == "mt5_server_wall_clock" and not blockers:
            normalized_provider_time = _wall_clock_to_utc(raw_tick_time, configured_timezone, configured_offset)

    effective_sources = sorted(
        set(verification_sources)
        | ({OFFICIAL_TIME_SOURCE} if provider_time_basis == "epoch_utc" else set())
        | ({"tick_candle_basis_comparison"} if tick_candle_agreement else set())
        | ({"winter_summer_observations"} if seasonal_verified else set())
        | ({"repeated_fixed_offset_observations"} if fixed_verified else set())
        | ({"terminal_clock_probe_current_live"} if terminal_current_live_verified else set())
    )
    generated_at_utc = terminal_evidence.get("terminalProbeCapturedAt")
    proof_state = "missing"
    proof_age_seconds = None
    expires_at_utc = None
    if generated_at_utc:
        try:
            generated_at = datetime.fromisoformat(str(generated_at_utc).replace("Z", "+00:00"))
            proof_age_seconds = max(0, round((system_time_utc - generated_at).total_seconds()))
            expires_at_utc = (generated_at + timedelta(seconds=180)).isoformat().replace("+00:00", "Z")
            proof_state = "fresh" if proof_age_seconds <= 120 else "expiring" if proof_age_seconds <= 180 else "stale"
        except ValueError:
            proof_state = "conflicting"
    terminal_probe_fingerprint = hashlib.sha256(json.dumps({
        "observationId": terminal_evidence.get("terminalProbeObservationId"),
        "probeInstanceId": terminal_evidence.get("terminalProbeInstanceId"),
        "capturedAtUtc": generated_at_utc,
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    quote_observation_fingerprint = hashlib.sha256(json.dumps({
        "rawTickTime": raw_tick_time,
        "rawTickTimeMsc": raw_tick_time_msc,
        "basis": terminal_evidence.get("pythonTransportBasis"),
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    candle_observation_fingerprint = hashlib.sha256(json.dumps({
        "rawLatestCandleTime": raw_candle_time,
        "timeframe": "M5",
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
    proof_core = {
        "contractId": TIME_CONTRACT_ID,
        "contractVersion": TIME_CONTRACT_VERSION,
        "verificationScope": "current_live",
        "providerTimeBasis": provider_time_basis,
        "observedOffsetMinutes": terminal_evidence.get("terminalObservedOffsetMinutes", observed_offset),
        "terminalClockClassificationVersion": terminal_evidence.get("terminalClockClassificationVersion"),
        "terminalProbeFingerprint": f"sha256:{terminal_probe_fingerprint}",
        "quoteObservationFingerprint": f"sha256:{quote_observation_fingerprint}",
        "candleObservationFingerprint": f"sha256:{candle_observation_fingerprint}",
        "generatedAtUtc": generated_at_utc,
        "expiresAtUtc": expires_at_utc,
        "currentLiveTimeBasisVerified": current_live_verified and proof_state == "fresh",
        "historicalDstPolicyVerified": False,
    }
    verification_artifact_id = "sha256:" + hashlib.sha256(
        json.dumps(proof_core, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    contract = {
        "contractId": TIME_CONTRACT_ID,
        "version": TIME_CONTRACT_VERSION,
        "providerTimeBasis": provider_time_basis,
        "providerTimezone": configured_timezone,
        "providerUtcOffsetMinutes": configured_offset,
        "dstPolicy": dst_policy,
        "configurationSource": "operator_config" if configured else "provider_metadata" if terminal_current_live_verified else "none",
        "verificationStatus": verification_status,
        "verificationSources": effective_sources,
        "providerDeclarationId": provider_declaration_id,
        "terminalMetadataVerificationId": terminal_metadata_verification_id,
        "rawServerTime": raw_tick_time,
        "rawServerTimeMsc": raw_tick_time_msc,
        "interpretedServerTimeUtc": utc_iso(raw_tick_time) if raw_tick_time is not None else None,
        "normalizedProviderTimeUtc": normalized_provider_time,
        "serverTimeUtc": normalized_provider_time if verification_status == "verified" else None,
        "systemTimeUtc": system_time_utc.isoformat().replace("+00:00", "Z"),
        "observedOffsetMinutes": observed_offset,
        "rawLatestCandleTime": raw_candle_time,
        "tickCandleBasisAgreement": tick_candle_agreement,
        "libraryTimeClaim": "epoch_utc",
        "libraryTimeClaimAgreement": library_claim_agreement,
        "observationSummary": summary,
        "verificationObservations": observations,
        "terminalBuild": terminal_build,
        "terminalVersion": terminal_version,
        "mt5PackageVersion": mt5_package_version,
        "strategySessionTimezone": "America/New_York",
        "currentLiveTimeBasisVerified": current_live_verified,
        "historicalDstPolicyVerified": historical_dst_verified,
        "timeVerificationScope": "historical" if historical_dst_verified else "current_live" if current_live_verified else "none",
        "phase2Eligible": bool(verification_status == "verified" and historical_dst_verified),
        "timeVerificationArtifactId": verification_artifact_id if generated_at_utc else None,
        "timeVerificationGeneratedAtUtc": generated_at_utc,
        "timeVerificationExpiresAtUtc": expires_at_utc,
        "timeVerificationProofState": proof_state,
        "timeVerificationProofAgeSeconds": proof_age_seconds,
        "terminalProbeFingerprint": f"sha256:{terminal_probe_fingerprint}" if generated_at_utc else None,
        "quoteObservationFingerprint": f"sha256:{quote_observation_fingerprint}" if generated_at_utc else None,
        "candleObservationFingerprint": f"sha256:{candle_observation_fingerprint}" if generated_at_utc else None,
        "readOnly": True,
        "marketDataOnly": True,
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "authority": AUTHORITY,
        **AUTHORITY,
        **terminal_evidence,
    }
    return {key: value for key, value in contract.items() if value is not None}


class Mt5ReadOnlyState:
    def __init__(self, terminal_path: str):
        self.terminal_path = terminal_path
        self.connected = False
        self.last_error: str | None = None
        self.last_connected_at: str | None = None

    def ensure_connected(self) -> bool:
        with MT5_LOCK:
            terminal = mt5.terminal_info() if self.connected else None
            if terminal is not None and bool(getattr(terminal, "connected", False)):
                return True

            mt5.shutdown()
            initialized = mt5.initialize(path=self.terminal_path, timeout=15000)
            terminal = mt5.terminal_info() if initialized else None
            self.connected = bool(initialized and terminal and getattr(terminal, "connected", False))
            if self.connected:
                self.last_error = None
                self.last_connected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            else:
                code, message = mt5.last_error()
                self.last_error = f"MT5 initialize failed ({code}): {message}"
            return self.connected

    def status(self, probe_terminal: bool = True) -> dict[str, Any]:
        # Process health must not queue behind a potentially slow MT5 history call.
        # The supervisor uses /health only to decide whether the service is alive;
        # /status and every data route still perform a live terminal check.
        connected = self.ensure_connected() if probe_terminal else self.connected
        return {
            "provider": "mt5_read_only_upstream",
            "serviceVersion": SERVICE_VERSION,
            "timeContractVersion": TIME_CONTRACT_VERSION,
            "connectionStatus": "connected" if connected else "degraded",
            "bridgeMode": "live" if connected else "degraded",
            "processHealth": "healthy",
            "terminalProbe": "live" if probe_terminal else "cached",
            "source": "mt5_terminal_session",
            "readOnly": True,
            "marketDataOnly": True,
            "latestEndpointAvailable": connected,
            "rangeEndpointAvailable": connected,
            "timeContractEndpointAvailable": connected,
            "lastConnectedAt": self.last_connected_at,
            "lastError": self.last_error,
            "authority": AUTHORITY,
            **AUTHORITY,
        }

    def time_contract(self, symbol: str = "USTECH", timeframe_value: int = mt5.TIMEFRAME_M5) -> dict[str, Any]:
        if not self.ensure_connected():
            raise RuntimeError(self.last_error or "MT5 terminal is unavailable")
        system_before_ms = time.time_ns() // 1_000_000
        with MT5_LOCK:
            terminal = mt5.terminal_info()
            terminal_version_tuple = mt5.version()
            tick = mt5.symbol_info_tick(symbol)
            rates = mt5.copy_rates_from_pos(symbol, timeframe_value, 0, 1)
            error = mt5.last_error()
        system_after_ms = time.time_ns() // 1_000_000
        if tick is None:
            raise RuntimeError(f"MT5 time-contract tick unavailable for {symbol}: {error}")
        raw_candle_time = int(rates[-1]["time"]) if rates is not None and len(rates) else None
        terminal_version = None
        if terminal_version_tuple:
            terminal_version = ".".join(str(item) for item in terminal_version_tuple)
        terminal_evidence: dict[str, Any] = {}
        if terminal is not None:
            try:
                observation = read_observation(
                    common_data_path=str(getattr(terminal, "commondata_path", "")),
                    terminal_data_path=str(getattr(terminal, "data_path", "")),
                    expected_symbol=symbol,
                )
                classification = classify_terminal_clock(
                    observation=observation,
                    system_utc_before_ms=system_before_ms,
                    system_utc_after_ms=system_after_ms,
                    python_tick_raw=int(tick.time),
                    python_tick_msc_raw=int(getattr(tick, "time_msc", 0)) or None,
                    python_latest_m5_bar_raw=raw_candle_time or 0,
                )
                terminal_evidence = compact_terminal_evidence(classification, observation)
            except TerminalClockObservationError as probe_error:
                terminal_evidence = {
                    "terminalEvidenceStatus": "missing",
                    "timeVerificationScope": "none",
                    "currentLiveTimeBasisVerified": False,
                    "historicalDstPolicyVerified": False,
                    "terminalClockClassificationVersion": "1.0.0",
                    "terminalProbeBlockers": [str(probe_error)],
                    "terminalProbeWarnings": [
                        "Attach the persistent GoTraderClockProbeEA to the connected symbol chart."
                    ],
                }
        return build_time_contract(
            environment=dict(os.environ),
            raw_tick_time=int(tick.time),
            raw_tick_time_msc=int(getattr(tick, "time_msc", 0)) or None,
            raw_candle_time=raw_candle_time,
            system_time_utc=datetime.now(timezone.utc),
            terminal_build=int(getattr(terminal, "build", 0)) or None if terminal is not None else None,
            terminal_version=terminal_version,
            mt5_package_version=str(getattr(mt5, "__version__", "")) or None,
            observations=load_time_verification_observations(dict(os.environ)),
            terminal_evidence=terminal_evidence,
        )


class Mt5ReadOnlyHandler(BaseHTTPRequestHandler):
    server_version = "GoTraderMt5ReadOnly/1.1"

    @property
    def state(self) -> Mt5ReadOnlyState:
        return self.server.state  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.send_header("Access-Control-Allow-Methods", "GET,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_json(204, {})

    def reject_mutation(self) -> None:
        self.send_json(
            403,
            {
                "error": "blocked_read_only_market_data_service",
                "message": "Only read-only symbols, quotes, and candle endpoints are available.",
                **AUTHORITY,
            },
        )

    def do_POST(self) -> None:  # noqa: N802
        self.reject_mutation()

    def do_PUT(self) -> None:  # noqa: N802
        self.reject_mutation()

    def do_PATCH(self) -> None:  # noqa: N802
        self.reject_mutation()

    def do_DELETE(self) -> None:  # noqa: N802
        self.reject_mutation()

    def require_connection(self) -> bool:
        if self.state.ensure_connected():
            return True
        self.send_json(503, {"error": "mt5_terminal_unavailable", "message": self.state.last_error, **AUTHORITY})
        return False

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)
        tokens = {token for token in path.lower().replace("-", "/").replace("_", "/").split("/") if token}

        if tokens & BLOCKED_PATH_TOKENS:
            self.reject_mutation()
            return

        if path == "/health":
            self.send_json(200, self.state.status(probe_terminal=False))
            return

        if path in {"/", "/status"}:
            self.send_json(200, self.state.status())
            return

        if not self.require_connection():
            return

        try:
            if path in {"/symbols", "/api/v1/market/symbols"}:
                self.handle_symbols()
                return
            if path in {"/time-contract", "/api/v1/market/time-contract"}:
                symbol = self.query_value(query, "symbol_name", "symbol", default="USTECH") or "USTECH"
                self.send_json(200, self.state.time_contract(symbol=symbol))
                return
            if path in {"/price", "/quote", "/api/v1/market/price"} or path.startswith("/api/v1/market/price/"):
                symbol = self.query_value(query, "symbol_name", "symbol")
                if not symbol and path.startswith("/api/v1/market/price/"):
                    symbol = unquote(path.rsplit("/", 1)[-1])
                self.handle_quote(symbol)
                return
            if path in {"/candles", "/api/v1/market/candles/latest"}:
                self.handle_latest(query)
                return
            if path in {
                "/candles/range",
                "/candles/by-date",
                "/api/v1/market/candles/range",
                "/api/v1/market/candles/by-date",
            }:
                self.handle_range(query)
                return
            self.send_json(404, {"error": "route_not_found", **AUTHORITY})
        except ValueError as error:
            self.send_json(400, {"error": "invalid_request", "message": str(error), **AUTHORITY})
        except Exception as error:  # keep the local service alive on MT5 IPC errors
            self.send_json(503, {"error": "market_data_unavailable", "message": str(error), **AUTHORITY})

    @staticmethod
    def query_value(query: dict[str, list[str]], *keys: str, default: str | None = None) -> str | None:
        for key in keys:
            values = query.get(key)
            if values and values[0]:
                return values[0]
        return default

    def timeframe(self, query: dict[str, list[str]]) -> tuple[str, int]:
        raw = str(self.query_value(query, "timeframe", default="M5")).upper()
        aliases = {"1M": "M1", "5M": "M5", "15M": "M15", "30M": "M30", "1H": "H1", "4H": "H4", "1D": "D1", "1W": "W1"}
        normalized = aliases.get(raw, raw)
        if normalized not in TIMEFRAMES:
            raise ValueError(f"Unsupported timeframe: {raw}")
        return normalized, TIMEFRAMES[normalized]

    def handle_symbols(self) -> None:
        with MT5_LOCK:
            symbols = mt5.symbols_get()
            error = mt5.last_error()
        if symbols is None:
            raise RuntimeError(f"MT5 symbols_get failed: {error}")
        self.send_json(200, [item.name for item in symbols])

    def handle_quote(self, symbol: str | None) -> None:
        if not symbol:
            raise ValueError("symbol_name is required")
        with MT5_LOCK:
            tick = mt5.symbol_info_tick(symbol)
            error = mt5.last_error()
        if tick is None:
            raise RuntimeError(f"MT5 quote unavailable for {symbol}: {error}")
        timestamp = utc_iso(int(tick.time))
        self.send_json(
            200,
            {
                "symbol": symbol,
                "bid": float(tick.bid),
                "ask": float(tick.ask),
                "last": float(tick.last),
                "volume": int(tick.volume),
                "time": timestamp,
                "timestamp": timestamp,
                "rawTime": int(tick.time),
                "rawTimeMsc": int(getattr(tick, "time_msc", 0)),
                "source": "mt5_symbol_info_tick",
                "readOnly": True,
                **AUTHORITY,
            },
        )

    def handle_latest(self, query: dict[str, list[str]]) -> None:
        symbol = self.query_value(query, "symbol_name", "symbol")
        if not symbol:
            raise ValueError("symbol_name is required")
        timeframe_name, timeframe_value = self.timeframe(query)
        count = min(max(int(self.query_value(query, "count", "limit", default="100") or 100), 1), MAX_CANDLES)
        with MT5_LOCK:
            rates = mt5.copy_rates_from_pos(symbol, timeframe_value, 0, count)
            error = mt5.last_error()
        if rates is None:
            raise RuntimeError(f"MT5 latest candles unavailable for {symbol} {timeframe_name}: {error}")
        candles = sorted((compact_candle(row) for row in rates), key=lambda item: item["timestamp"])
        self.send_json(200, candles)

    def handle_range(self, query: dict[str, list[str]]) -> None:
        symbol = self.query_value(query, "symbol_name", "symbol")
        date_from_raw = self.query_value(query, "date_from", "from", "start")
        date_to_raw = self.query_value(query, "date_to", "to", "end")
        if not symbol or not date_from_raw or not date_to_raw:
            raise ValueError("symbol_name, date_from, and date_to are required")
        timeframe_name, timeframe_value = self.timeframe(query)
        date_from = parse_iso(date_from_raw)
        date_to = parse_iso(date_to_raw)
        if date_from >= date_to:
            raise ValueError("date_from must be before date_to")
        count = min(max(int(self.query_value(query, "count", "limit", default=str(MAX_CANDLES)) or MAX_CANDLES), 1), MAX_CANDLES)
        with MT5_LOCK:
            rates = mt5.copy_rates_range(symbol, timeframe_value, date_from, date_to)
            error = mt5.last_error()
        if rates is None:
            raise RuntimeError(f"MT5 range candles unavailable for {symbol} {timeframe_name}: {error}")
        candles = sorted((compact_candle(row) for row in rates), key=lambda item: item["timestamp"])[-count:]
        self.send_json(
            200,
            {
                "symbol_name": symbol,
                "symbol": symbol,
                "timeframe": timeframe_name,
                "date_from": date_from.isoformat().replace("+00:00", "Z"),
                "date_to": date_to.isoformat().replace("+00:00", "Z"),
                "requestedCount": count,
                "returnedCount": len(candles),
                "firstCandleTime": candles[0]["timestamp"] if candles else None,
                "lastCandleTime": candles[-1]["timestamp"] if candles else None,
                "source": "mt5_copy_rates_range",
                "readOnly": True,
                "status": "available" if candles else "unavailable",
                "limitationReason": None if candles else "MT5 returned no candles for the requested range.",
                "candles": candles,
                **AUTHORITY,
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="GoTrader loopback-only MT5 read-only market-data upstream")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--path", default=os.getenv("MT5_PATH", DEFAULT_TERMINAL_PATH))
    args = parser.parse_args()

    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit("MT5 read-only upstream must bind to loopback only.")
    if not Path(args.path).is_file():
        raise SystemExit(f"MT5 terminal was not found at {args.path}")

    state = Mt5ReadOnlyState(args.path)
    if not state.ensure_connected():
        raise SystemExit(state.last_error or "Unable to attach to the logged-in MT5 terminal.")

    server = ThreadingHTTPServer((args.host, args.port), Mt5ReadOnlyHandler)
    server.state = state  # type: ignore[attr-defined]

    def stop_server(_signum: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop_server)
    signal.signal(signal.SIGTERM, stop_server)
    print(f"GoTrader MT5 read-only upstream listening on http://{args.host}:{args.port}", flush=True)
    print("Routes: health, status, time contract, symbols, quote, latest candles, range candles. Execution routes do not exist.", flush=True)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
        with MT5_LOCK:
            mt5.shutdown()


if __name__ == "__main__":
    main()
