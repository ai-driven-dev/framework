import type { BranchSnapshot } from "../branch-binding.js";

export interface BindingSnapshotStore {
  /** The latest snapshot of each branch, keyed by `snapshotKey`. */
  latest(): Promise<ReadonlyMap<string, BranchSnapshot>>;
  /** Adds snapshots; none already taken is ever changed. */
  append(snapshots: readonly BranchSnapshot[]): Promise<void>;
}
