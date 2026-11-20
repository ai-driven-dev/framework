import type { TaskDeclaration } from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type {
  BranchBindingStore,
  BranchHeads,
} from "../../../../src/contexts/telemetry/ports/branch-binding-store.js";

export class FakeBranchStore implements BranchBindingStore {
  heads_: BranchHeads = { head: "refs/heads/feat/x", originHead: null };
  readonly declared: { root: string; branch: string; declaration: TaskDeclaration }[] = [];

  constructor(readonly events: string[] = []) {}

  async heads(): Promise<BranchHeads> {
    return this.heads_;
  }

  async declare(root: string, branch: string, declaration: TaskDeclaration): Promise<void> {
    this.events.push("declare");
    this.declared.push({ root, branch, declaration });
  }
}
