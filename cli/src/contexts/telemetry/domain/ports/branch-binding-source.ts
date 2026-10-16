import type { BranchConfigBinding } from "../branch-binding.js";

/** What a repository's git keeps about its branch declarations. */
export interface BranchBindingSource {
  /** Every branch that carries a declaration, from the repository's own config. */
  bindings(root: string): Promise<readonly BranchConfigBinding[]>;
  /** The oldest reflog entry of a branch, or `null` when its reflog says nothing. */
  createdAt(root: string, branch: string): Promise<string | null>;
}
