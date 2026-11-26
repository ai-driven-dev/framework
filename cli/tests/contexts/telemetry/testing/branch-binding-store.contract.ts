import { expect, it } from "vitest";
import { declarationOf } from "../../../../src/contexts/telemetry/domain/declaration/task-declaration.js";
import type { BranchBindingStore } from "../../../../src/contexts/telemetry/ports/branch-binding-store.js";
import { type ContractSubject, describeSubject } from "./contract-subject.builder.js";

export interface BranchBindingStoreSubject extends ContractSubject {
  readonly store: BranchBindingStore;
  readonly root: string;
  /** The branch the subject's HEAD is on. */
  readonly branch: string;
}

const AT = new Date("2026-10-09T10:00:00.000Z");

/** What the branch binding store promises, stated once and run against every implementation of it. */
export function describeBranchBindingStoreContract(
  subjectName: string,
  makeSubject: () => Promise<BranchBindingStoreSubject>
): void {
  describeSubject(
    `when a branch's declaration is kept by ${subjectName}`,
    makeSubject,
    (subject) => {
      it("names the branch HEAD is on, with no remote head while there is no remote", async () => {
        const { store, root, branch } = subject();

        expect(await store.heads(root)).toEqual({ head: `refs/heads/${branch}`, originHead: null });
      });

      it("accepts a declaration with a ticket, then one with none, over the same branch", async () => {
        const { store, root, branch } = subject();

        await store.declare(
          root,
          branch,
          declarationOf({ kind: "task", task: "ship it", ticket: "ABC-1" }, AT)
        );
        await expect(
          store.declare(
            root,
            branch,
            declarationOf({ kind: "task", task: "ship it", ticket: null }, AT)
          )
        ).resolves.toBeUndefined();
      });
    }
  );
}
