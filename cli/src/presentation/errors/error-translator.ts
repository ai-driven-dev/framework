import type { Output } from "../../orchestration/domain/output.js";

/** Reports the error and ends the process with a failure code. */
export function failCommand(output: Output, error: unknown): never {
  output.error(error instanceof Error ? error.message : String(error));
  return output.exit(1);
}
