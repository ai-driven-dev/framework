/** Orders text by its code units: the same order on every machine and in every locale, which
 * is what a file that must come out byte for byte the same needs. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
