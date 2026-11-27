import { join } from "node:path";
import type { PrivateStorage } from "../../../../../shared/ports/private-storage.js";
import { type BranchSnapshot, snapshotKey } from "../../../domain/branch-binding.js";
import { parseBranchSnapshot } from "../../../domain/declaration/branch-snapshot-line.js";
import { linesIn } from "../../../domain/read-back.js";
import type { BindingSnapshotStore } from "../../../ports/bindings/binding-snapshot-store.js";
import { readTextIfPresent } from "../../reading/text-file.js";

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
    for (const snapshot of await this.read()) {
      const key = snapshotKey(snapshot.repository_id, snapshot.branch);
      history.set(key, [...(history.get(key) ?? []), snapshot]);
    }
    return history;
  }

  async latest(): Promise<ReadonlyMap<string, BranchSnapshot>> {
    const latest = new Map<string, BranchSnapshot>();
    for (const snapshot of await this.read()) {
      latest.set(snapshotKey(snapshot.repository_id, snapshot.branch), snapshot);
    }
    return latest;
  }

  /** Every snapshot, in the order taken. */
  private async read(): Promise<BranchSnapshot[]> {
    return linesIn(await readTextIfPresent(this.path)).flatMap(
      (line) => parseBranchSnapshot(line) ?? []
    );
  }

  async append(snapshots: readonly BranchSnapshot[]): Promise<void> {
    await this.storage.ensureDirectory(this.dir);
    await this.storage.append(
      this.path,
      `${snapshots.map((snapshot) => JSON.stringify(snapshot)).join("\n")}\n`
    );
  }
}
