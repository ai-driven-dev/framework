import type { Output } from "../../orchestration/domain/output.js";
import { AiddError } from "../../shared/domain/shared.error.js";
import { MESSAGES } from "./error-messages.presenter.js";

/** The words a failure shows: a catalogued error through its table entry, anything else as it came. */
export function render(error: unknown): string {
  if (error instanceof AiddError) return MESSAGES[error.code]?.(error) ?? error.message;
  return error instanceof Error ? error.message : String(error);
}

/** Reports the error and ends the process with a failure code. */
export function failCommand(output: Output, error: unknown): never {
  output.error(render(error));
  return output.exit(1);
}
