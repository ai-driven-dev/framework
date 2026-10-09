import { needsReflog, nextSnapshot, snapshotKey } from "../domain/branch-binding.js";
import type { BindingSnapshotStore } from "../domain/ports/binding-snapshot-store.js";
import type { BranchBindingSource } from "../domain/ports/branch-binding-source.js";

/** Records what a repository's branches are declared as, right now. Attribution reads only
 * these snapshots, so a branch that is deleted or renamed later keeps the work it carried. */
export class SnapshotBindingsUseCase {
  constructor(
    private readonly source: BranchBindingSource,
    private readonly store: BindingSnapshotStore,
    private readonly now: () => Date
  ) {}

  /** How many snapshots were added: none when every branch still reads as it did. */
  async execute(repositoryId: string, root: string): Promise<number> {
    const observed = await this.source.bindings(root);
    if (observed.length === 0) return 0;
    const latest = await this.store.latest();
    const taken = [];
    for (const binding of observed) {
      const previous = latest.get(snapshotKey(repositoryId, binding.branch));
      const created = needsReflog(previous, binding)
        ? await this.source.createdAt(root, binding.branch)
        : null;
      const next = nextSnapshot(repositoryId, previous, binding, created, this.now().toISOString());
      if (next !== null) taken.push(next);
    }
    if (taken.length > 0) await this.store.append(taken);
    return taken.length;
  }
}
