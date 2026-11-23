import { AiddError } from "../../shared/domain/shared.error.js";
import type { Output } from "../terminal/output.model.js";
import { EXIT_CODES, UNCATALOGUED_EXIT } from "./error-exit-codes.presenter.js";
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

/** Reports the error and ends the process with the exit code its table entry gives. */
export function failCommand(output: Output, error: unknown): never {
  output.error(render(error));
  return output.exit(error instanceof AiddError ? EXIT_CODES[error.code] : UNCATALOGUED_EXIT);
}
