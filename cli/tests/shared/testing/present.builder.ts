/**
 * A value a test has just seen held, narrowed past `undefined`. An indexed read of a match or an
 * array types as possibly absent under `noUncheckedIndexedAccess`; reading it here states what
 * was missing instead of asserting it away.
 */
export function present<T>(value: T | undefined, what = "value"): T {
  if (value === undefined) throw new Error(`expected ${what} to be present`);
  return value;
}
