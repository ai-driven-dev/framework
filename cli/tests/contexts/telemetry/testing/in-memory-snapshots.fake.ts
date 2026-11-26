import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { BindingSnapshotStore } from "../../../../src/contexts/telemetry/ports/bindings/binding-snapshot-store.js";

export class InMemorySnapshots implements BindingSnapshotStore {
  constructor(readonly events: string[] = []) {}
  readonly appended: BranchSnapshot[] = [];
  latestReads = 0;
  appendCalls = 0;

  async latest(): Promise<ReadonlyMap<string, BranchSnapshot>> {
    this.latestReads += 1;
    return new Map(this.appended.map((s) => [snapshotKey(s.repository_id, s.branch), s]));
  }

  async history(): Promise<ReadonlyMap<string, readonly BranchSnapshot[]>> {
    const history = new Map<string, BranchSnapshot[]>();
    for (const s of this.appended) {
      const key = snapshotKey(s.repository_id, s.branch);
      history.set(key, [...(history.get(key) ?? []), s]);
    }
    return history;
  }

  async append(snapshots: readonly BranchSnapshot[]): Promise<void> {
    this.appendCalls += 1;
    this.events.push("snapshot");
    this.appended.push(...snapshots);
  }
}
