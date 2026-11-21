import {
  type BranchConfigBinding,
  needsReflog,
  nextSnapshot,
  snapshotKey,
} from "../domain/branch-binding.js";
import type { LockWait } from "../domain/declaration/task-declaration.js";
import type { BindingSnapshotStore } from "../ports/bindings/binding-snapshot-store.js";
import type { BindingsLock } from "../ports/bindings/bindings-lock.js";
import type { BranchBindingSource } from "../ports/branch-binding-source.js";

export interface SnapshotBindingsRequest {
  readonly repositoryId: string;
  readonly root: string;
  readonly wait?: LockWait;
}

interface SnapshotBindingsDeps {
  readonly source: BranchBindingSource;
  readonly store: BindingSnapshotStore;
  readonly lock: BindingsLock;
  readonly now: () => Date;
}

/** Records what a repository's branches are declared as, right now. Attribution reads only
 * these snapshots, so a branch that is deleted or renamed later keeps the work it carried. */
export class SnapshotBindings {
  constructor(private readonly deps: SnapshotBindingsDeps) {}

  /** How many snapshots were added: none when every branch still reads as it did. Reading
   * the branch config and the latest snapshots, and appending to them, is one step under the
   * bindings lock, because a declaration and an ingest both take snapshots and a config read
   * before the lock could be older than a snapshot taken while waiting for it. A repository
   * declaring nothing is told so without taking the lock. */
  async execute({ repositoryId, root, wait }: SnapshotBindingsRequest): Promise<number> {
    if ((await this.deps.source.bindings(root)).length === 0) return 0;
    return this.deps.lock.exclusively(
      async () => this.append(repositoryId, root, await this.deps.source.bindings(root)),
      wait
    );
  }

  private async append(
    repositoryId: string,
    root: string,
    observed: readonly BranchConfigBinding[]
  ): Promise<number> {
    const latest = await this.deps.store.latest();
    const taken = [];
    for (const binding of observed) {
      const previous = latest.get(snapshotKey(repositoryId, binding.branch));
      const created = needsReflog(previous, binding)
        ? await this.deps.source.createdAt(root, binding.branch)
        : null;
      const next = nextSnapshot({
        repositoryId,
        latest: previous,
        observed: binding,
        reflogCreatedAt: created,
        now: this.deps.now().toISOString(),
      });
      if (next !== null) taken.push(next);
    }
    if (taken.length > 0) await this.deps.store.append(taken);
    return taken.length;
  }
}
