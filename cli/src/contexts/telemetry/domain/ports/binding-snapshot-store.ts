import type { BranchSnapshot } from "../branch-binding.js";

export interface BindingSnapshotStore {
  /** The latest snapshot of each branch, keyed by `snapshotKey`. */
  latest(): Promise<ReadonlyMap<string, BranchSnapshot>>;
  /** Every snapshot taken, oldest first, by `snapshotKey`: a branch name reused after the branch
   * was deleted has one generation per creation, and each keeps its own work. */
  history(): Promise<ReadonlyMap<string, readonly BranchSnapshot[]>>;
  /** Adds snapshots; none already taken is ever changed. */
  append(snapshots: readonly BranchSnapshot[]): Promise<void>;
}
