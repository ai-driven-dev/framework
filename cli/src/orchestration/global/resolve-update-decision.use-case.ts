import { InputRequiredError } from "../../shared/domain/shared.error.js";
import type { BulkConflictState } from "../domain/bulk-conflict-state.js";
import type { Prompter } from "../ports/prompter.js";

export interface ResolveUpdateDecisionRequest {
  relativePath: string;
  userForce: boolean;
  interactive: boolean;
  bulkState: BulkConflictState;
}

/**
 * Returns true when the file should be overwritten, false when it should be kept; throws
 * `InputRequiredError` for a non-interactive run without `--force`. Consulted only for a modified
 * file: the caller handles an unmodified one.
 */
export class ResolveUpdateDecision {
  constructor(private readonly prompter: Prompter) {}

  async execute(options: ResolveUpdateDecisionRequest): Promise<boolean> {
    const { relativePath, userForce, interactive, bulkState } = options;
    if (!userForce && !interactive) {
      throw new InputRequiredError(
        `Use --force to overwrite modified files in non-interactive mode.`
      );
    }
    if (userForce) return true;
    return this.resolveInteractive(relativePath, bulkState);
  }

  private async resolveInteractive(
    relativePath: string,
    bulkState: BulkConflictState
  ): Promise<boolean> {
    const existing = bulkState.get();
    if (existing === "overwrite-all") return true;
    if (existing === "skip-all") return false;
    const decision = await this.prompter.resolveConflictBulk(relativePath, "modified");
    if (decision === "overwrite-all" || decision === "skip-all") {
      bulkState.record(decision);
    }
    return decision === "overwrite" || decision === "overwrite-all";
  }
}
