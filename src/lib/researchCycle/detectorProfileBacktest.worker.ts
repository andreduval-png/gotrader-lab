import { runBacktest } from "@/lib/backtesting";
import type { BacktestConfig, BacktestResult } from "@/lib/backtesting";
import type { Candle } from "@/lib/types";

interface DetectorBacktestWorkerRequest {
  candles: Candle[];
  config: BacktestConfig;
}

type DetectorBacktestWorkerResponse =
  | { ok: true; result: BacktestResult }
  | { ok: false; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<DetectorBacktestWorkerRequest>) => void) | null;
  postMessage: (message: DetectorBacktestWorkerResponse) => void;
};

scope.onmessage = (event) => {
  try {
    scope.postMessage({
      ok: true,
      result: runBacktest(event.data.candles, event.data.config)
    });
  } catch (error) {
    scope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Detector-profile backtest failed."
    });
  }
};

export {};
