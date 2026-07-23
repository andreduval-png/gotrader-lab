const sequenceFor = (value) => {
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) && sequence >= 0
    ? sequence
    : undefined;
};

export function resolveAcceptanceBaselineSequence({
  feedLastSequence,
  events = []
} = {}) {
  const statusSequence = sequenceFor(feedLastSequence);
  if (statusSequence !== undefined) return statusSequence;
  return events.reduce(
    (maximum, event) =>
      Math.max(maximum, sequenceFor(event?.sequence) ?? maximum),
    0
  );
}

export function eventsAfterAcceptanceBaseline({
  events = [],
  baselineSequence
} = {}) {
  const baseline = sequenceFor(baselineSequence) ?? 0;
  return events.filter((event) => {
    const sequence = sequenceFor(event?.sequence);
    return sequence !== undefined && sequence > baseline;
  });
}
