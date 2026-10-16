import type { BranchConfigBinding } from "../branch-binding.js";

/** What a repository's git keeps about its branch declarations. */
export interface BranchBindingSource {
  /** Every branch the command declared, from the repository's own config. */
  bindings(root: string): Promise<readonly BranchConfigBinding[]>;
  /** When a branch took its name, from its reflog (see `branchCreatedAt`), or `null` when its
   * reflog says nothing. */
  createdAt(root: string, branch: string): Promise<string | null>;
}
