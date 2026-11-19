import type { DriftVerdict } from "./drift.js";

type RestoreReason = "deleted" | "modified";

export interface RecordedVerdict {
  readonly relativePath: string;
  readonly verdict: DriftVerdict;
}

export interface RestoreStep {
  readonly kind: "rewrite" | "unrestorable";
  readonly relativePath: string;
  readonly reason: RestoreReason;
}

/**
 * What a restore must do for each recorded file, in recorded order. A file that drifted and that the
 * current distribution still provides is rewritten. One the distribution no longer provides has
 * nothing to restore from, so it is only reported. Asking the user is the caller's concern.
 */
export function planRestore(
  recorded: readonly RecordedVerdict[],
  distributed: ReadonlySet<string>
): RestoreStep[] {
  const steps: RestoreStep[] = [];
  for (const { relativePath, verdict } of recorded) {
    if (verdict === "ok") continue;
    const reason: RestoreReason = verdict === "missing" ? "deleted" : "modified";
    steps.push({
      kind: distributed.has(relativePath) ? "rewrite" : "unrestorable",
      relativePath,
      reason,
    });
  }
  return steps;
}
