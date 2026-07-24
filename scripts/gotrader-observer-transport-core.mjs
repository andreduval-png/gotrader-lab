export async function fetchObserverJsonWithRetry(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = 4_000,
    retryLimit = 1,
    retryDelayMs = 100,
    delay = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  } = {}
) {
  const errors = [];
  for (let attempt = 1; attempt <= retryLimit + 1; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      return Object.freeze({
        payload: await response.json(),
        attempts: attempt,
        recovered: attempt > 1,
        warnings:
          attempt > 1
            ? Object.freeze([
                `observer_transport_recovered_after_retry:${url}`
              ])
            : Object.freeze([])
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (attempt <= retryLimit) await delay(retryDelayMs);
    }
  }
  const failure = new Error(
    `observer_transport_unavailable_after_retry:${url}:${errors.at(-1)}`
  );
  failure.attemptErrors = errors;
  throw failure;
}
