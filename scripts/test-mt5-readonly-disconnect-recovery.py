#!/usr/bin/env python3
"""Deterministic outage/reconnect test for the loopback MT5 upstream."""

from __future__ import annotations

import json
import runpy
import threading
import time
from pathlib import Path
from types import SimpleNamespace


workspace = Path(__file__).resolve().parents[1]
module = runpy.run_path(str(workspace / "scripts" / "mt5-readonly-upstream.py"))
Mt5ReadOnlyState = module["Mt5ReadOnlyState"]
authority = module["AUTHORITY"]


class FakeMt5:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.allow_connection = False
        self.initialized = False
        self.terminal_connected = False
        self.initialize_calls = 0

    def initialize(self, **_kwargs):
        with self.lock:
            self.initialize_calls += 1
            allowed = self.allow_connection
        time.sleep(0.05)
        with self.lock:
            self.initialized = allowed
            self.terminal_connected = allowed
            return allowed

    def shutdown(self):
        with self.lock:
            self.initialized = False

    def terminal_info(self):
        with self.lock:
            if not self.initialized:
                return None
            return SimpleNamespace(connected=self.terminal_connected)

    @staticmethod
    def last_error():
        return (-10005, "fixture IPC timeout")


def wait_for(predicate, timeout_seconds: float = 2.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.01)
    raise AssertionError("condition did not become true before timeout")


fake = FakeMt5()
state = Mt5ReadOnlyState(
    "fixture-terminal.exe",
    mt5_module=fake,
    initialize_timeout_ms=1_000,
    health_check_interval_seconds=0.02,
    reconnect_backoff_seconds=(0.02, 0.04),
)
state.start()
try:
    wait_for(lambda: state.status()["connectionFailureCount"] >= 1)
    started = time.perf_counter()
    disconnected_statuses = [state.status() for _ in range(100)]
    health_elapsed_ms = (time.perf_counter() - started) * 1_000
    assert health_elapsed_ms < 100
    assert all(item["processHealth"] == "healthy" for item in disconnected_statuses)
    assert all(item["connectionStatus"] == "degraded" for item in disconnected_statuses)
    assert all(item["terminalConnectionState"] in {"reconnecting", "terminal_disconnected"} for item in disconnected_statuses)
    assert state.ensure_connected() is False

    fake.allow_connection = True
    state.schedule_next_attempt(0)
    state.wake_event.set()
    wait_for(lambda: state.status()["connectionStatus"] == "connected")
    connected = state.status()
    assert connected["connectionEpoch"] == 1
    assert connected["latestEndpointAvailable"] is True

    fake.allow_connection = False
    fake.terminal_connected = False
    wait_for(lambda: state.status()["connectionStatus"] == "degraded")
    assert state.ensure_connected() is False

    fake.allow_connection = True
    state.schedule_next_attempt(0)
    state.wake_event.set()
    wait_for(lambda: state.status()["connectionStatus"] == "connected")
    reconnected = state.status()
    assert reconnected["connectionEpoch"] == 2
    assert reconnected["connectionFailureCount"] == 0
finally:
    state.stop()

serialized = json.dumps(
    {
        "connected": reconnected,
        "healthElapsedMs": round(health_elapsed_ms, 3),
        "authority": authority,
    }
)
for forbidden in ["account", "order", "position", "execute", "password", "secret"]:
    assert forbidden not in serialized.lower()
assert authority == {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none",
}

print(
    json.dumps(
        {
            "status": "passed",
            "nonBlockingHealth": True,
            "serializedReconnectAttempts": True,
            "failClosedWhileDisconnected": True,
            "freshConnectionEpochRequired": True,
            "healthElapsedMs": round(health_elapsed_ms, 3),
            **authority,
        },
        indent=2,
    )
)
