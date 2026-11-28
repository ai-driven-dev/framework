import type { BranchConfigBinding } from "../../domain/branch-binding.js";
import { type BranchRole, branchHeadOf } from "../../domain/declaration/branch-role.js";
import type { BranchBindingSource } from "../../ports/branch-binding-source.js";
import type { BranchBindingStore } from "../../ports/branch-binding-store.js";

export interface ReadCurrentBranchResult {
  /** `null` when `HEAD` is detached. */
  readonly name: string | null;
  readonly role: BranchRole;
  /** What the branch declares: only a working branch is ever read for one. */
  readonly declared: BranchConfigBinding | null;
}

/** The branch being worked on and what is declared on it. */
export class ReadCurrentBranch {
  constructor(
    private readonly store: BranchBindingStore,
    private readonly source: BranchBindingSource
  ) {}

  async execute(root: string): Promise<ReadCurrentBranchResult> {
    const heads = await this.store.heads(root);
    const { role, branch: name } = branchHeadOf(heads.head, heads.originHead);
    const declared =
      role === "working"
        ? ((await this.source.bindings(root)).find((binding) => binding.branch === name) ?? null)
        : null;
    return { name, role, declared };
  }
}
