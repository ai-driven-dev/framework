import { branchRoleOf, currentBranchOf } from "../../domain/declaration/branch-role.js";
import type { TaskDeclaration } from "../../domain/declaration/task-declaration.js";
import type { BranchBindingStore } from "../../ports/branch-binding-store.js";
import type { SnapshotBindings } from "../snapshot-bindings.use-case.js";

export interface DeclareOnBranchRequest {
  readonly repositoryId: string;
  readonly root: string;
  readonly declaration: TaskDeclaration;
}

export type DeclareOnBranchResult =
  | { readonly status: "bound"; readonly branch: string }
  | {
      readonly status: "untouched";
      readonly reason: "default-branch" | "detached";
      readonly branch: string | null;
    };

/** Declares on a working branch and snapshots at once, while the branch's reflog still
 * tells when it was created. The default branch and a detached head are left alone. */
export class DeclareOnBranch {
  constructor(
    private readonly store: BranchBindingStore,
    private readonly snapshots: SnapshotBindings
  ) {}

  async execute({
    repositoryId,
    root,
    declaration,
  }: DeclareOnBranchRequest): Promise<DeclareOnBranchResult> {
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
    await this.snapshots.execute({ repositoryId, root });
    return { status: "bound", branch };
  }
}
