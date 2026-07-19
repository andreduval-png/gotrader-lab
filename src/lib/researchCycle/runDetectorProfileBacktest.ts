import { runBacktest } from "@/lib/backtesting";
import type { BacktestConfig, BacktestResult } from "@/lib/backtesting";
import type { Candle } from "@/lib/types";

type WorkerResponse =
  | { ok: true; result: BacktestResult }
  | { ok: false; error: string };

export async function runDetectorProfileBacktest(input: {
  candles: Candle[];
  config: BacktestConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<BacktestResult> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return runBacktest(input.candles, input.config);
  }

  return new Promise<BacktestResult>((resolve, reject) => {
    const worker = new Worker(
      new URL("./detectorProfileBacktest.worker.ts", import.meta.url),
      { type: "module", name: "gotrader-detector-profile-backtest" }
    );
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new Error("Detector-profile backtest canceled by user.")));
    const timeout = globalThis.setTimeout(
      () => finish(() => reject(new Error("Detector-profile backtest timed out safely."))),
      Math.max(30_000, input.timeoutMs ?? 120_000)
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.ok) {
        const result = response.result;
        finish(() => resolve(result));
      } else {
        const error = response.error;
        finish(() => reject(new Error(error)));
      }
    };
    worker.onerror = (event) => {
      finish(() => reject(new Error(event.message || "Detector-profile worker failed.")));
    };
    worker.onmessageerror = () => {
      finish(() => reject(new Error("Detector-profile worker returned an unreadable result.")));
    };
    if (input.signal?.aborted) {
      abort();
      return;
    }
    input.signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ candles: input.candles, config: input.config });
  });
}
