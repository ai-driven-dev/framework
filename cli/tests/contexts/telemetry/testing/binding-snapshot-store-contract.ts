import { expect, it } from "vitest";
import {
  type BranchSnapshot,
  snapshotKey,
} from "../../../../src/contexts/telemetry/domain/branch-binding.js";
import type { BindingSnapshotStore } from "../../../../src/contexts/telemetry/ports/bindings/binding-snapshot-store.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface SnapshotStoreSubject extends ContractSubject {
  readonly store: BindingSnapshotStore;
}

function snapshot(overrides: Partial<BranchSnapshot> = {}): BranchSnapshot {
  return {
    repository_id: "r",
    branch: "feat/x",
    task: "t",
    ticket: null,
    declared_at: "2026-10-07T10:00:00.000Z",
    none: false,
    branch_created_at: "2026-10-06T00:00:00.000Z",
    snapshot_at: "2026-10-07T10:00:01.000Z",
    ...overrides,
  };
}

/** What the snapshot store promises, stated once and run against every implementation of it. */
export function describeBindingSnapshotStoreContract(
  subjectName: string,
  makeSubject: () => Promise<SnapshotStoreSubject>
): void {
  describeSubject(`when the binding snapshot store is ${subjectName}`, makeSubject, (subject) => {
    it("is empty before the first snapshot", async () => {
      expect((await subject().store.latest()).size).toBe(0);
      expect((await subject().store.history()).size).toBe(0);
    });

    it("keeps every snapshot of a branch name in order, one generation after another", async () => {
      await subject().store.append([snapshot({ task: "a" })]);
      await subject().store.append([
        snapshot({ task: "b", branch_created_at: "2026-10-15T00:00:00.000Z" }),
        snapshot({ branch: "other" }),
      ]);

      const history = await subject().store.history();

      expect(history.get(snapshotKey("r", "feat/x"))?.map((entry) => entry.task)).toEqual([
        "a",
        "b",
      ]);
      expect(history.get(snapshotKey("r", "other"))).toHaveLength(1);
    });

    it("answers the latest snapshot of each branch of each repository", async () => {
      await subject().store.append([snapshot({ task: "first" }), snapshot({ branch: "other" })]);
      await subject().store.append([
        snapshot({ task: "second" }),
        snapshot({ repository_id: "r2" }),
      ]);

      const latest = await subject().store.latest();

      expect(latest.get(snapshotKey("r", "feat/x"))?.task).toBe("second");
      expect(latest.get(snapshotKey("r", "other"))?.task).toBe("t");
      expect(latest.get(snapshotKey("r2", "feat/x"))?.task).toBe("t");
    });
  });
}
