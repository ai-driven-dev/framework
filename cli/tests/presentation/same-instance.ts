/**
 * An argument matcher by identity. `toHaveBeenCalledWith` compares by structure, so a second
 * catalog built from the same profiles would pass for the one the test handed in.
 */
export function sameInstance(expected: object): { asymmetricMatch: (actual: unknown) => boolean } {
  return { asymmetricMatch: (actual) => actual === expected };
}
