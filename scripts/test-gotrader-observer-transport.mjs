#!/usr/bin/env node

import assert from "node:assert/strict";
import { fetchObserverJsonWithRetry } from "./gotrader-observer-transport-core.mjs";

let attempts = 0;
const recovered = await fetchObserverJsonWithRetry(
  "http://observer.test/status",
  {
    retryDelayMs: 0,
    delay: async () => {},
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("fixture_timeout");
      return {
        ok: true,
        json: async () => ({ state: "healthy" })
      };
    }
  }
);
assert.equal(recovered.recovered, true);
assert.equal(recovered.attempts, 2);
assert.equal(recovered.payload.state, "healthy");
assert.equal(recovered.warnings.length, 1);

await assert.rejects(
  fetchObserverJsonWithRetry("http://observer.test/status", {
    retryDelayMs: 0,
    delay: async () => {},
    fetchImpl: async () => {
      throw new Error("fixture_unavailable");
    }
  }),
  /observer_transport_unavailable_after_retry/
);

console.log(
  JSON.stringify(
    {
      status: "passed",
      singleRetry: true,
      recoveredFailureClassifiedAsWarning: true,
      unrecoveredFailurePreserved: true
    },
    null,
    2
  )
);
