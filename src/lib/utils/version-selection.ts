// Pure helpers for picking two route versions to compare (History tab).

/** Toggle `version`; at most two stay selected and the newest pick replaces the oldest. */
export function toggleVersionSelection(selected: number[], version: number): number[] {
  if (selected.includes(version)) return selected.filter((v) => v !== version);
  if (selected.length >= 2) return [selected[1], version];
  return [...selected, version];
}

/** [older, newer] for exactly two selected versions, else null. */
export function comparePair(selected: number[]): [number, number] | null {
  if (selected.length !== 2) return null;
  const [a, b] = selected;
  return a < b ? [a, b] : [b, a];
}
