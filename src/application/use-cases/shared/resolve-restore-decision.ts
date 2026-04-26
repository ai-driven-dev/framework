import type { Prompter } from "../../../domain/ports/prompter.js";
import { InputRequiredError } from "../../errors.js";

/**
 * Returns true when the file should be kept (skipped), false when it should be restored.
 * Throws InputRequiredError when a modified file is encountered in non-interactive non-force mode.
 */
export async function resolveRestoreDecision(
  prompter: Prompter,
  relativePath: string,
  reason: "deleted" | "modified",
  force: boolean,
  interactive: boolean
): Promise<boolean> {
  if (reason !== "modified") return false;
  if (!force && !interactive) {
    throw new InputRequiredError(
      `Use --force to overwrite modified files in non-interactive mode.`
    );
  }
  if (!force && interactive) {
    const decision = await prompter.resolveConflict(relativePath, reason);
    return decision === "keep";
  }
  return false;
}
