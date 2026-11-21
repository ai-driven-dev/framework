import type { Output } from "../../orchestration/domain/output.js";
import { AiddError } from "../../shared/domain/shared.error.js";
import { MESSAGES } from "./error-messages.presenter.js";

/** The words a failure shows: a catalogued error through its table entry, anything else as it came. */
export function render(error: unknown): string {
  if (error instanceof AiddError) return MESSAGES[error.code](error, render);
  return error instanceof Error ? error.message : String(error);
}

/** A caught value as a log line tails it: `String(value)` for a plain one, the name and words
 * for a catalogued one. */
export function describeCause(cause: unknown): string {
  return cause instanceof AiddError ? `${cause.name}: ${render(cause)}` : String(cause);
}

/** Reports the error and ends the process with a failure code. */
export function failCommand(output: Output, error: unknown): never {
  output.error(render(error));
  return output.exit(1);
}
