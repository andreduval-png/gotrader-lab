export const OPERATIONAL_MARKET_STATE_VERSION =
  "gotrader-operational-market-state-v1";

export const operationalMarketStateAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const DEFAULT_USTECH_SESSION_SCHEDULE = Object.freeze({
  scheduleId: "ustech-cfd-proxy-cme-equity-hours-v1",
  timeZone: "America/New_York",
  sundayOpenMinute: 18 * 60,
  weekdayBreakStartMinute: 17 * 60,
  weekdayBreakEndMinute: 18 * 60,
  fridayCloseMinute: 17 * 60
});

const weekdayIndex = Object.freeze({
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
});

const finiteTime = (value) => {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const zonedParts = (nowUtc, timeZone) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(nowUtc))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    weekday: weekdayIndex[parts.weekday],
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
    localClock: `${parts.weekday} ${parts.hour}:${parts.minute}:${parts.second}`
  };
};

export function evaluateConfiguredMarketSession({
  nowUtc = new Date().toISOString(),
  schedule = DEFAULT_USTECH_SESSION_SCHEDULE
} = {}) {
  const nowMs = finiteTime(nowUtc);
  if (nowMs === undefined) {
    return Object.freeze({
      status: "unknown",
      reason: "market_session_time_invalid",
      scheduleId: schedule.scheduleId,
      timeZone: schedule.timeZone
    });
  }
  const { weekday, minuteOfDay, localClock } = zonedParts(
    nowUtc,
    schedule.timeZone
  );
  let open = false;
  let reason = "configured_weekly_market_break";
  if (weekday === 0) {
    open = minuteOfDay >= schedule.sundayOpenMinute;
    reason = open ? "configured_sunday_session_open" : "configured_weekend_close";
  } else if (weekday >= 1 && weekday <= 4) {
    open =
      minuteOfDay < schedule.weekdayBreakStartMinute ||
      minuteOfDay >= schedule.weekdayBreakEndMinute;
    reason = open
      ? "configured_weekday_session_open"
      : "configured_daily_maintenance_break";
  } else if (weekday === 5) {
    open = minuteOfDay < schedule.fridayCloseMinute;
    reason = open ? "configured_friday_session_open" : "configured_weekend_close";
  } else {
    reason = "configured_weekend_close";
  }
  return Object.freeze({
    status: open ? "open" : "closed",
    reason,
    scheduleId: schedule.scheduleId,
    timeZone: schedule.timeZone,
    localClock
  });
}

export function classifyOperationalMarketState({
  nowUtc = new Date().toISOString(),
  quoteObservedAt,
  terminalProbeCapturedAt,
  terminalConnected = true,
  transportConnected = true,
  quoteQuietThresholdMs = 120_000,
  quoteUnverifiedThresholdMs = 10 * 60_000,
  schedule = DEFAULT_USTECH_SESSION_SCHEDULE
} = {}) {
  const session = evaluateConfiguredMarketSession({ nowUtc, schedule });
  const nowMs = finiteTime(nowUtc);
  const quoteMs = finiteTime(quoteObservedAt);
  const probeMs = finiteTime(terminalProbeCapturedAt);
  const quoteAgeMs =
    nowMs !== undefined && quoteMs !== undefined
      ? Math.max(0, nowMs - quoteMs)
      : undefined;
  const terminalState =
    terminalConnected === true ? "connected" : "disconnected";
  const transportState =
    transportConnected === true ? "connected" : "disconnected";

  let marketState = "time_unverified";
  let reason = "market_state_evidence_incomplete";
  if (session.status === "closed") {
    marketState = "market_closed";
    reason = session.reason;
  } else if (
    session.status === "open" &&
    terminalConnected === true &&
    transportConnected === true &&
    quoteAgeMs !== undefined
  ) {
    if (quoteAgeMs <= quoteQuietThresholdMs) {
      marketState = "market_open";
      reason = "configured_session_open_quote_fresh";
    } else if (quoteAgeMs <= quoteUnverifiedThresholdMs) {
      marketState = "market_quiet";
      reason = "configured_session_open_quote_quiet";
    } else {
      reason = "configured_session_open_quote_stale";
    }
  }

  const operationalState =
    transportState === "disconnected"
      ? "transport_disconnected"
      : terminalState === "disconnected"
        ? "terminal_disconnected"
        : marketState;

  return Object.freeze({
    version: OPERATIONAL_MARKET_STATE_VERSION,
    operationalState,
    marketState,
    transportState,
    terminalState,
    reason,
    observedAtUtc: nowUtc,
    quoteObservedAt,
    terminalProbeCapturedAt,
    quoteAgeSeconds:
      quoteAgeMs === undefined ? undefined : Math.round(quoteAgeMs / 1_000),
    terminalProbeAgeSeconds:
      nowMs === undefined || probeMs === undefined
        ? undefined
        : Math.max(0, Math.round((nowMs - probeMs) / 1_000)),
    schedule: session,
    proofPauseEligible:
      marketState === "market_closed" && session.status === "closed",
    freshCorrelationRequiredToResume: marketState === "market_closed",
    historicalDstPolicyVerified: false,
    rawCandlesPersisted: false,
    productionAdoptionAllowed: false,
    ...operationalMarketStateAuthority
  });
}
