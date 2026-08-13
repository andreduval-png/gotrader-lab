#!/usr/bin/env python3
"""Focused recovery test for the loopback-only MT5 market-data service."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("mt5-readonly-upstream.py")
SPEC = importlib.util.spec_from_file_location("gotrader_mt5_readonly_upstream", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Unable to load MT5 read-only upstream module")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class FakeTerminal:
    connected = True


class FakeMt5:
    def __init__(self) -> None:
        self.initialize_count = 0
        self.shutdown_count = 0

    def terminal_info(self) -> FakeTerminal:
        return FakeTerminal()

    def shutdown(self) -> None:
        self.shutdown_count += 1

    def initialize(self, **_kwargs: object) -> bool:
        self.initialize_count += 1
        return True

    @staticmethod
    def last_error() -> tuple[int, str]:
        return (-10005, "stale IPC session")


fake_mt5 = FakeMt5()
MODULE.mt5 = fake_mt5
state = MODULE.Mt5ReadOnlyState("terminal64.exe")
state.connected = True
read_count = 0


def recoverable_read() -> list[str] | None:
    global read_count
    read_count += 1
    return None if read_count == 1 else ["recovered_market_data"]


result = state.read_market_data("test latest candles", recoverable_read)
assert result == ["recovered_market_data"]
assert read_count == 2
assert fake_mt5.initialize_count == 1
assert fake_mt5.shutdown_count == 1
assert state.reconnect_count == 1
assert state.last_data_error is None
assert state.last_data_recovered_at is not None

failed_state = MODULE.Mt5ReadOnlyState("terminal64.exe")
failed_state.connected = True
try:
    failed_state.read_market_data("test exhausted read", lambda: None)
    raise AssertionError("Exhausted market-data read should fail closed")
except RuntimeError as error:
    assert "test exhausted read failed" in str(error)
assert failed_state.last_data_error is not None
assert failed_state.connected is False

assert MODULE.AUTHORITY == {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}

print(
    json.dumps(
        {
            "passed": True,
            "readAttempts": read_count,
            "reconnectCount": state.reconnect_count,
            "recoveredAtRecorded": state.last_data_recovered_at is not None,
            "exhaustedReadFailedClosed": failed_state.connected is False,
            "authority": MODULE.AUTHORITY,
        },
        indent=2,
    )
)
