type BulkDecision = "overwrite-all" | "skip-all";

/**
 * Created once per update run and passed to every per-tool call, so "overwrite all" / "skip all"
 * persists across tools and files.
 */
export class BulkConflictState {
  private decision: BulkDecision | null = null;

  get(): BulkDecision | null {
    return this.decision;
  }

  record(choice: BulkDecision): void {
    this.decision = choice;
  }
}
