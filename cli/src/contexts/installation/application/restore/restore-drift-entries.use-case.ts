import { InputRequiredError } from "../../../../shared/domain/shared.error.js";

/** Answers, for one drifted file, whether to keep what is on disk or restore it. The restore
 * asks; whoever owns the conversation with the person answers. */
export interface ConflictResolver {
  resolveConflict(
    relativePath: string,
    reason: "deleted" | "modified"
  ): Promise<"keep" | "overwrite">;
}

export interface DriftDescriptor {
  relativePath: string;
  reason: "deleted" | "modified";
}

/**
 * Entries that can actually be restored (`drift`), and entries the manifest still tracks as drifted
 * but the current distribution no longer provides anything to restore them from (`unrestorable`).
 */
export interface DriftCollection<TDrift extends DriftDescriptor> {
  drift: TDrift[];
  unrestorable: DriftDescriptor[];
}

/**
 * The I/O leaf: everything that differs between restoring a whole file and merging drifted keys
 * back into one. The skeleton never branches on which leaf it is running.
 */
export interface RestoreDriftLeaf<TDrift extends DriftDescriptor, TResult> {
  collectDrift(): Promise<DriftCollection<TDrift>>;
  restore(entry: TDrift): Promise<void>;
  buildResult(restored: string[], kept: string[], unrestorable: string[]): TResult;
}

/** The single place the keep/overwrite decision lives: both restore flows inject their own leaf
 * rather than duplicating the loop. */
export class RestoreDriftEntries {
  constructor(private readonly conflicts: ConflictResolver) {}

  async execute<TDrift extends DriftDescriptor, TResult>(
    leaf: RestoreDriftLeaf<TDrift, TResult>,
    { force, interactive }: { force: boolean; interactive: boolean }
  ): Promise<TResult | null> {
    const { drift, unrestorable } = await leaf.collectDrift();
    if (drift.length === 0 && unrestorable.length === 0) return null;

    const restored: string[] = [];
    const kept: string[] = [];

    for (const entry of drift) {
      if (await this.keeps(entry, { force, interactive })) {
        kept.push(entry.relativePath);
        continue;
      }
      await leaf.restore(entry);
      restored.push(entry.relativePath);
    }

    return leaf.buildResult(
      restored,
      kept,
      unrestorable.map((entry) => entry.relativePath)
    );
  }

  /** True when the file stays as it is. Throws InputRequiredError when a modified file meets a
   * non-interactive run that does not force. */
  private async keeps(
    { relativePath, reason }: DriftDescriptor,
    { force, interactive }: { force: boolean; interactive: boolean }
  ): Promise<boolean> {
    if (reason !== "modified" || force) return false;
    if (!interactive) {
      throw new InputRequiredError(
        `Use --force to overwrite modified files in non-interactive mode.`
      );
    }
    return (await this.conflicts.resolveConflict(relativePath, reason)) === "keep";
  }
}
