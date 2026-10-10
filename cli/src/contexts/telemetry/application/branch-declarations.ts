import type { BranchConfigBinding } from "../domain/branch-binding.js";
import {
  type BranchRole,
  branchRoleOf,
  currentBranchOf,
} from "../domain/declaration/branch-role.js";
import { lockWaitFor, type TaskDeclaration } from "../domain/declaration/task-declaration.js";
import type { BranchBindingSource } from "../domain/ports/branch-binding-source.js";
import type { BranchBindingStore } from "../domain/ports/branch-binding-store.js";
import type { SnapshotBindingsUseCase } from "./snapshot-bindings-use-case.js";

export interface CurrentBranch {
  /** `null` when `HEAD` is detached. */
  readonly name: string | null;
  readonly role: BranchRole;
  /** What the branch declares: only a working branch is ever read for one. */
  readonly declared: BranchConfigBinding | null;
}

export type BranchOutcome =
  | { readonly status: "bound"; readonly branch: string }
  | {
      readonly status: "untouched";
      readonly reason: "default-branch" | "detached";
      readonly branch: string | null;
    };

/** The branch being worked on and what is declared on it. */
export class BranchDeclarations {
  constructor(
    private readonly store: BranchBindingStore,
    private readonly source: BranchBindingSource,
    private readonly snapshots: SnapshotBindingsUseCase
  ) {}

  async current(root: string): Promise<CurrentBranch> {
    const heads = await this.store.heads(root);
    const role = branchRoleOf(heads.head, heads.originHead);
    const name = currentBranchOf(heads.head);
    const declared =
      role === "working"
        ? ((await this.source.bindings(root)).find((binding) => binding.branch === name) ?? null)
        : null;
    return { name, role, declared };
  }

  /** Declares on a working branch and snapshots at once, while the branch's reflog still
   * tells when it was created. The default branch and a detached head are left alone. */
  async declare(
    repositoryId: string,
    root: string,
    declaration: TaskDeclaration
  ): Promise<BranchOutcome> {
    const heads = await this.store.heads(root);
    const role = branchRoleOf(heads.head, heads.originHead);
    const branch = currentBranchOf(heads.head);
    if (role !== "working" || branch === null) {
      return {
        status: "untouched",
        reason: role === "detached" ? "detached" : "default-branch",
        branch,
      };
    }
    await this.store.declare(root, branch, declaration);
    await this.snapshots.execute(repositoryId, root, lockWaitFor(declaration.by));
    return { status: "bound", branch };
  }
}
