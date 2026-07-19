export function notifyResearchCycleObserver<T>(
  onUpdate: ((snapshot: T) => void) | undefined,
  snapshot: T
): boolean {
  if (!onUpdate) return true;
  try {
    onUpdate(snapshot);
    return true;
  } catch (error) {
    console.warn("Research cycle observer failed without interrupting deterministic validation.", {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}
