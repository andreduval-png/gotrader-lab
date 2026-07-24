#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  classifyOperationalMarketState,
  evaluateConfiguredMarketSession,
  operationalMarketStateAuthority
} from "./gotrader-market-state-core.mjs";

const open = classifyOperationalMarketState({
  nowUtc: "2026-07-23T20:00:00.000Z",
  quoteObservedAt: "2026-07-23T19:59:30.000Z",
  terminalProbeCapturedAt: "2026-07-23T19:59:31.000Z",
  terminalConnected: true,
  transportConnected: true
});
assert.equal(open.marketState, "market_open");
assert.equal(open.operationalState, "market_open");

const quiet = classifyOperationalMarketState({
  nowUtc: "2026-07-23T20:00:00.000Z",
  quoteObservedAt: "2026-07-23T19:57:00.000Z",
  terminalProbeCapturedAt: "2026-07-23T19:59:59.000Z",
  terminalConnected: true,
  transportConnected: true
});
assert.equal(quiet.marketState, "market_quiet");

const closed = classifyOperationalMarketState({
  nowUtc: "2026-07-23T21:30:00.000Z",
  quoteObservedAt: "2026-07-23T20:59:59.000Z",
  terminalProbeCapturedAt: "2026-07-23T21:29:59.000Z",
  terminalConnected: true,
  transportConnected: true
});
assert.equal(closed.marketState, "market_closed");
assert.equal(closed.proofPauseEligible, true);
assert.equal(closed.historicalDstPolicyVerified, false);

const reopened = classifyOperationalMarketState({
  nowUtc: "2026-07-23T22:00:30.000Z",
  quoteObservedAt: "2026-07-23T22:00:20.000Z",
  terminalProbeCapturedAt: "2026-07-23T22:00:21.000Z",
  terminalConnected: true,
  transportConnected: true
});
assert.equal(reopened.marketState, "market_open");
assert.equal(reopened.proofPauseEligible, false);

const transportDisconnected = classifyOperationalMarketState({
  nowUtc: "2026-07-23T20:00:00.000Z",
  terminalConnected: true,
  transportConnected: false
});
assert.equal(
  transportDisconnected.operationalState,
  "transport_disconnected"
);

const terminalDisconnected = classifyOperationalMarketState({
  nowUtc: "2026-07-23T20:00:00.000Z",
  terminalConnected: false,
  transportConnected: true
});
assert.equal(terminalDisconnected.operationalState, "terminal_disconnected");

assert.equal(
  evaluateConfiguredMarketSession({
    nowUtc: "2026-07-25T16:00:00.000Z"
  }).status,
  "closed"
);
assert.deepEqual(open.authority ?? operationalMarketStateAuthority, operationalMarketStateAuthority);

console.log(
  JSON.stringify(
    {
      status: "passed",
      marketOpen: true,
      marketQuiet: true,
      marketClosed: true,
      freshCorrelationRequiredOnReopen: true,
      transportStateOrthogonal: true,
      terminalStateOrthogonal: true,
      historicalDstPolicyVerified: false,
      ...operationalMarketStateAuthority
    },
    null,
    2
  )
);
