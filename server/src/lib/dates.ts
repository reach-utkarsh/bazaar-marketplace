export function daysAgo(days: number, from = new Date()): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

/** Builds a continuous series of YYYY-MM-DD keys (UTC) so charts have no gaps. */
export function dayKeys(days: number, from = new Date()): string[] {
  const start = daysAgo(days, from);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
