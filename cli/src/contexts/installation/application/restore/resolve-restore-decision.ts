import { InputRequiredError } from "../../../../shared/domain/shared.error.js";

/** Answers, for one drifted file, whether to keep what is on disk or restore it. The restore
 * asks; whoever owns the conversation with the person answers. */
export interface ConflictResolver {
  resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite">;
}

interface ResolveRestoreDecisionCommand {
  relativePath: string;
  reason: "deleted" | "modified";
  force: boolean;
  interactive: boolean;
}

/**
 * Returns true when the file should be kept (skipped), false when it should be restored.
 * Throws InputRequiredError when a modified file is encountered in non-interactive non-force mode.
 */
export async function resolveRestoreDecision(
  conflicts: ConflictResolver,
  options: ResolveRestoreDecisionCommand
): Promise<boolean> {
  const { relativePath, reason, force, interactive } = options;
  if (reason !== "modified") return false;
  if (!force && !interactive) {
    throw new InputRequiredError(
      `Use --force to overwrite modified files in non-interactive mode.`
    );
  }
  if (!force && interactive) {
    const decision = await conflicts.resolveConflict(relativePath, reason);
    return decision === "keep";
  }
  return false;
}
