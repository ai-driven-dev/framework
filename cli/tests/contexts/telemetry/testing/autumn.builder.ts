/** Every UTC day of an autumn, September to November, to read a window as the days it holds. */
export const AUTUMN: readonly string[] = Array.from({ length: 91 }, (_, n) =>
  new Date(Date.parse("2026-09-01T00:00:00.000Z") + n * 86_400_000).toISOString().slice(0, 10)
);
