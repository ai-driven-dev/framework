import { exitWith } from "../exit.js";
import type { CLIOutput } from "../output.js";

/** Reports the error and ends the process with a failure code. */
export function failCommand(output: CLIOutput, error: unknown): never {
  output.error(error instanceof Error ? error.message : String(error));
  return exitWith(1);
}
