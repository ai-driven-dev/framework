import type { TaskDeclaration } from "../declaration/task-declaration.js";

/** Where `HEAD` and the remote's head point, as git names them. */
export interface BranchHeads {
  /** `refs/heads/<name>`, `null` when `HEAD` is detached. */
  readonly head: string | null;
  /** `refs/remotes/origin/<name>`, `null` when the remote has no head. */
  readonly originHead: string | null;
}

/** A repository's own git config, where a branch's declaration is kept. It follows the branch
 * through a rename and goes with it when the branch is deleted. */
export interface BranchBindingStore {
  heads(root: string): Promise<BranchHeads>;
  /** Makes the branch declared as `declaration` says: what it does not name is removed, so a
   * new declaration never keeps a stale ticket. */
  declare(root: string, branch: string, declaration: TaskDeclaration): Promise<void>;
}
