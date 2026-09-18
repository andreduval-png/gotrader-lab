export const OPERATOR_STALL_MS = 180_000;
export const OPERATOR_MAX_CYCLE_MS = 15 * 60_000;

export function awaitOperatorAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new Error("Operator cycle canceled"));
    };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

// Progress resets the stall budget; it can never extend the total cycle budget.
export function createOperatorCycleGuard(
  controller: AbortController,
  { stallMs = OPERATOR_STALL_MS, totalMs = OPERATOR_MAX_CYCLE_MS } = {}
) {
  const timeout = () => controller.abort("operator_timeout");
  let stall: ReturnType<typeof setTimeout>;
  let disposed = false;
  const progress = () => {
    if (disposed || controller.signal.aborted) return;
    clearTimeout(stall);
    stall = setTimeout(timeout, stallMs);
  };
  const total = setTimeout(timeout, totalMs);
  const dispose = () => {
    disposed = true;
    clearTimeout(total);
    clearTimeout(stall);
    controller.signal.removeEventListener("abort", dispose);
  };
  controller.signal.addEventListener("abort", dispose, { once: true });
  progress();
  if (controller.signal.aborted) dispose();
  return { progress, dispose };
}
