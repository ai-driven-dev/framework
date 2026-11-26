import { asPlainObject } from "../../../../../shared/domain/reading/plain-object.js";
import { counter, expected, type Json } from "../../../domain/transcript/line-values.js";

/** The iterations a message lists, a note kept for each shape that is not one. */
export function messageIterations(usage: Json, notes: string[]): Json[] {
  const raw = usage.iterations;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    notes.push("usage.iterations is not a list");
    return [];
  }
  return raw.flatMap((entry: unknown) => {
    const iteration = asPlainObject(entry);
    if (iteration === null) notes.push("usage.iterations holds a non-object");
    return iteration === null ? [] : [iteration];
  });
}

/** The top-level `cache_creation` split reflects only the first iteration, so the writes are
 * summed over every message iteration. */
export function cacheWrites(
  usage: Json,
  iterations: readonly Json[],
  notes: string[]
): { readonly total: number | null; readonly oneHour: number | null } {
  const messages = iterations.filter((iteration) => iteration.type === "message");
  const parts = messages.length > 0 ? messages : [usage];
  const writes = parts.map((part) => expected("usage", notes)(part, "cache_creation_input_tokens"));
  const hours = parts.map((part) =>
    counter(asPlainObject(part.cache_creation)?.ephemeral_1h_input_tokens)
  );
  return {
    total: writes.includes(null) ? null : sum(writes),
    oneHour: hours.includes(null) ? null : sum(hours),
  };
}

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((all, value) => all + (value ?? 0), 0);
}
