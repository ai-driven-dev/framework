import { join } from "node:path";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import { type BranchSnapshot, parseBranchSnapshot, snapshotKey } from "../domain/branch-binding.js";
import type { BindingSnapshotStore } from "../domain/ports/bindings/binding-snapshot-store.js";
import type { PrivateStorage } from "../domain/ports/private-storage.js";

/** `branches.jsonl`: append-only, one snapshot per line, the latest line of a branch being its
 * current one. It is appended to, never rewritten, because a snapshot is a fact about a moment
 * and no later snapshot may change it. */
export class BindingSnapshotStoreAdapter implements BindingSnapshotStore {
  private readonly path: string;

  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(dir, "branches.jsonl");
  }

  async history(): Promise<ReadonlyMap<string, readonly BranchSnapshot[]>> {
    const history = new Map<string, BranchSnapshot[]>();
    for (const line of ((await readTextIfPresent(this.path)) ?? "").split("\n")) {
      const snapshot = parseBranchSnapshot(line);
      if (snapshot === null) continue;
      const key = snapshotKey(snapshot.repository_id, snapshot.branch);
      history.set(key, [...(history.get(key) ?? []), snapshot]);
    }
    return history;
  }

  async latest(): Promise<ReadonlyMap<string, BranchSnapshot>> {
    const latest = new Map<string, BranchSnapshot>();
    for (const line of ((await readTextIfPresent(this.path)) ?? "").split("\n")) {
      const snapshot = parseBranchSnapshot(line);
      if (snapshot !== null)
        latest.set(snapshotKey(snapshot.repository_id, snapshot.branch), snapshot);
    }
    return latest;
  }

  async append(snapshots: readonly BranchSnapshot[]): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.append(
      this.path,
      `${snapshots.map((snapshot) => JSON.stringify(snapshot)).join("\n")}\n`
    );
  }
}
