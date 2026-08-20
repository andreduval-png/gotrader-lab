#!/usr/bin/env python3
"""Minimal loopback-only MT5 market-data service for GoTrader.

The service attaches to an already authenticated MetaTrader 5 Desktop session.
It exposes symbols, quotes, and OHLCV candles only. Account, order, position,
deal, trade, and mutation routes do not exist.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import MetaTrader5 as mt5


AUTHORITY = {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}
DEFAULT_TERMINAL_PATH = r"C:\Program Files\MetaTrader 5\terminal64.exe"
MAX_CANDLES = 5000
MT5_LOCK = threading.Lock()

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
    candle = {
        "time": utc_iso(int(row["time"])),
        "timestamp": utc_iso(int(row["time"])),
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


class Mt5ReadOnlyState:
    def __init__(self, terminal_path: str):
        self.terminal_path = terminal_path
        self.connected = False
        self.last_error: str | None = None
        self.last_connected_at: str | None = None
        self.reconnect_count = 0
        self.last_data_error: str | None = None
        self.last_data_error_at: str | None = None
        self.last_data_recovered_at: str | None = None

    def ensure_connected(self, force: bool = False) -> bool:
        with MT5_LOCK:
            terminal = mt5.terminal_info() if self.connected and not force else None
            if terminal is not None and bool(getattr(terminal, "connected", False)):
                return True

            mt5.shutdown()
            initialized = mt5.initialize(path=self.terminal_path, timeout=15000)
            terminal = mt5.terminal_info() if initialized else None
            self.connected = bool(initialized and terminal and getattr(terminal, "connected", False))
            if self.connected:
                if force:
                    self.reconnect_count += 1
                self.last_error = None
                self.last_connected_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            else:
                code, message = mt5.last_error()
                self.last_error = f"MT5 initialize failed ({code}): {message}"
            return self.connected

    def read_market_data(self, label: str, operation: Any) -> Any:
        """Run one market-data read and recover once from a stale MT5 IPC session."""
        last_error: Any = None
        for attempt in range(2):
            if not self.ensure_connected(force=attempt > 0):
                last_error = self.last_error
            else:
                with MT5_LOCK:
                    try:
                        result = operation()
                        last_error = mt5.last_error()
                    except Exception as error:  # MetaTrader5 can raise on stale IPC handles
                        result = None
                        last_error = error
                if result is not None:
                    if attempt > 0:
                        self.last_data_recovered_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                    self.last_data_error = None
                    self.last_data_error_at = None
                    self.connected = True
                    return result

            self.connected = False
            self.last_data_error = f"{label} failed: {last_error}"
            self.last_data_error_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            if attempt == 0:
                time.sleep(0.2)

        raise RuntimeError(self.last_data_error or f"{label} failed after reconnect")

    def status(self, probe_terminal: bool = True) -> dict[str, Any]:
        # Process health must not queue behind a potentially slow MT5 history call.
        # The supervisor uses /health only to decide whether the service is alive;
        # /status and every data route still perform a live terminal check.
        connected = self.ensure_connected() if probe_terminal else self.connected
        return {
            "provider": "mt5_read_only_upstream",
            "connectionStatus": "connected" if connected else "degraded",
            "bridgeMode": "live" if connected else "degraded",
            "processHealth": "healthy",
            "terminalProbe": "live" if probe_terminal else "cached",
            "source": "mt5_terminal_session",
            "readOnly": True,
            "marketDataOnly": True,
            "latestEndpointAvailable": connected,
            "rangeEndpointAvailable": connected,
            "lastConnectedAt": self.last_connected_at,
            "lastError": self.last_error,
            "reconnectCount": self.reconnect_count,
            "lastDataError": self.last_data_error,
            "lastDataErrorAt": self.last_data_error_at,
            "lastDataRecoveredAt": self.last_data_recovered_at,
            "authority": AUTHORITY,
            **AUTHORITY,
        }


class Mt5ReadOnlyHandler(BaseHTTPRequestHandler):
    server_version = "GoTraderMt5ReadOnly/1.0"

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
        try:
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            # Local health/data callers can time out while MT5 IPC is recovering.
            # Their disconnect must not flood logs or affect the server process.
            return

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
        symbols = self.state.read_market_data("MT5 symbols_get", mt5.symbols_get)
        self.send_json(200, [item.name for item in symbols])

    def handle_quote(self, symbol: str | None) -> None:
        if not symbol:
            raise ValueError("symbol_name is required")
        tick = self.state.read_market_data(
            f"MT5 quote for {symbol}",
            lambda: mt5.symbol_info_tick(symbol),
        )
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
        rates = self.state.read_market_data(
            f"MT5 latest candles for {symbol} {timeframe_name}",
            lambda: mt5.copy_rates_from_pos(symbol, timeframe_value, 0, count),
        )
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
        rates = self.state.read_market_data(
            f"MT5 range candles for {symbol} {timeframe_name}",
            lambda: mt5.copy_rates_range(symbol, timeframe_value, date_from, date_to),
        )
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
        print(
            "MT5 terminal is not ready; starting the read-only upstream in degraded mode. "
            f"Live status and market-data requests will retry the terminal connection. Last error: {state.last_error}",
            flush=True,
        )

    server = ThreadingHTTPServer((args.host, args.port), Mt5ReadOnlyHandler)
    server.state = state  # type: ignore[attr-defined]

    def stop_server(_signum: int, _frame: Any) -> None:
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop_server)
    signal.signal(signal.SIGTERM, stop_server)
    print(f"GoTrader MT5 read-only upstream listening on http://{args.host}:{args.port}", flush=True)
    print("Routes: health, status, symbols, quote, latest candles, range candles. Execution routes do not exist.", flush=True)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        server.server_close()
        with MT5_LOCK:
            mt5.shutdown()


if __name__ == "__main__":
    main()
