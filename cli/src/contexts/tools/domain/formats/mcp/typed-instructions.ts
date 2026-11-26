import { stripJsonComments } from "../../../../../shared/domain/reading/jsonc.js";
import { asPlainObject } from "../../../../../shared/domain/reading/plain-object.js";

function parse(content: string | null): Record<string, unknown> {
  return content === null ? {} : (asPlainObject(JSON.parse(stripJsonComments(content))) ?? {});
}

function listedIn(config: Record<string, unknown>): readonly unknown[] {
  return Array.isArray(config.instructions) ? config.instructions : [];
}

/** The config with `glob` listed in `instructions`, once, after what a person already lists. */
export function addTypedInstruction(existing: string | null, glob: string): string {
  const full = parse(existing);
  const listed = listedIn(full);
  if (listed.includes(glob)) return existing ?? "";
  return JSON.stringify({ ...full, instructions: [...listed, glob] }, null, 2);
}

/** The config without `glob` in `instructions`, the list dropped once empty; the config as it
 * was when `glob` is not listed. */
export function removeTypedInstruction(existing: string, glob: string): string {
  const full = parse(existing);
  const listed = listedIn(full);
  if (!listed.includes(glob)) return existing;
  const rest = { ...full };
  const kept = listed.filter((entry) => entry !== glob);
  if (kept.length === 0) delete rest.instructions;
  else rest.instructions = kept;
  return JSON.stringify(rest, null, 2);
}
