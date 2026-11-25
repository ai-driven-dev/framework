import type { HooksBrand } from "../../../src/contexts/tools/domain/formats/hooks/descriptor.js";

/** A literal standing in for a declared descriptor: only the builders' reading of it is under test. */
export function routed<T extends object>(routing: T): HooksBrand & T {
  return routing as HooksBrand & T;
}
