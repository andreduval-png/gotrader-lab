#!/usr/bin/env python3
"""Read one allowlisted terminal clock observation and correlate it with MT5 Python."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import MetaTrader5 as mt5

from v2_mt5_terminal_clock import AUTHORITY, TerminalClockObservationError, classify_terminal_clock, read_observation


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--terminal-path", default=r"C:\Program Files\MetaTrader 5\terminal64.exe")
    parser.add_argument("--symbol", default="USTECH")
    args = parser.parse_args()
    system_before_ms = time.time_ns() // 1_000_000
    if not mt5.initialize(path=args.terminal_path, timeout=15_000):
        print(json.dumps({"status": "source_unavailable", "reason": str(mt5.last_error()), "authority": AUTHORITY}))
        return 0
    try:
        terminal = mt5.terminal_info()
        if terminal is None or not bool(getattr(terminal, "connected", False)):
            print(json.dumps({"status": "source_unavailable", "reason": "terminal_not_connected", "authority": AUTHORITY}))
            return 0
        observation = read_observation(
            common_data_path=str(getattr(terminal, "commondata_path", "")),
            terminal_data_path=str(getattr(terminal, "data_path", "")),
        )
        tick = mt5.symbol_info_tick(args.symbol)
        rates = mt5.copy_rates_from_pos(args.symbol, mt5.TIMEFRAME_M5, 0, 1)
        if tick is None or rates is None or len(rates) != 1:
            print(json.dumps({"status": "source_unavailable", "reason": "python_tick_or_bar_unavailable", "authority": AUTHORITY}))
            return 0
        system_after_ms = time.time_ns() // 1_000_000
        classification = classify_terminal_clock(
            observation=observation,
            system_utc_before_ms=system_before_ms,
            system_utc_after_ms=system_after_ms,
            python_tick_raw=int(tick.time),
            python_tick_msc_raw=int(getattr(tick, "time_msc", 0)) or None,
            python_latest_m5_bar_raw=int(rates[-1]["time"]),
        )
        print(json.dumps({
            "status": "complete",
            "observation": observation,
            "python": {
                "tickRaw": int(tick.time),
                "tickMscRaw": int(getattr(tick, "time_msc", 0)) or None,
                "latestM5BarRaw": int(rates[-1]["time"]),
                "systemUtcBeforeMs": system_before_ms,
                "systemUtcAfterMs": system_after_ms,
            },
            "classification": classification,
            "rawCandleArraysPrinted": False,
            "authority": AUTHORITY,
        }, separators=(",", ":")))
        return 0
    except TerminalClockObservationError as error:
        print(json.dumps({"status": "probe_unavailable", "reason": str(error), "authority": AUTHORITY}))
        return 0
    finally:
        mt5.shutdown()


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
