import { expect, it } from "vitest";
import type { BranchBindingSource } from "../../../../src/contexts/telemetry/ports/branch-binding-source.js";
import { type ContractSubject, describeSubject } from "./contract-subject.js";

export interface BranchDeclaration {
  readonly branch: string;
  readonly task: string | null;
  readonly ticket: string | null;
  readonly declaredAt: string;
}

export interface BranchBindingSourceSubject extends ContractSubject {
  readonly source: BranchBindingSource;
  /** The repository the source reads. */
  readonly root: string;
  /** Leaves the declaration the way the declaring command does. */
  declare(declaration: BranchDeclaration): Promise<void>;
  /** Creates `branch` at the instant `at`, as its reflog will say. */
  createBranch(branch: string, at: string): Promise<void>;
}

const DECLARED_AT = "2026-10-07T10:00:00.000Z";

/** What the branch binding source promises, stated once and run against every implementation. */
export function describeBranchBindingSourceContract(
  subjectName: string,
  makeSubject: () => Promise<BranchBindingSourceSubject>
): void {
  describeSubject(`when the branch binding source is ${subjectName}`, makeSubject, (subject) => {
    it("holds no binding while no branch is declared", async () => {
      expect(await subject().source.bindings(subject().root)).toEqual([]);
    });

    it("reads a declaration whole", async () => {
      await subject().declare({
        branch: "feat/x",
        task: "checkout-fix",
        ticket: "PROJ-12",
        declaredAt: DECLARED_AT,
      });

      expect(await subject().source.bindings(subject().root)).toEqual([
        {
          branch: "feat/x",
          task: "checkout-fix",
          ticket: "PROJ-12",
          declared_at: DECLARED_AT,
          none: false,
        },
      ]);
    });

    it("reads a declaration of no task as none", async () => {
      await subject().declare({ branch: "x", task: null, ticket: null, declaredAt: DECLARED_AT });

      expect(await subject().source.bindings(subject().root)).toEqual([
        { branch: "x", task: null, ticket: null, declared_at: DECLARED_AT, none: true },
      ]);
    });

    it("dates a branch from when it was created", async () => {
      await subject().createBranch("feat/old", "2026-01-02T03:04:05Z");

      expect(await subject().source.createdAt(subject().root, "feat/old")).toBe(
        "2026-01-02T03:04:05.000Z"
      );
    });

    it("cannot date a branch it has never heard of", async () => {
      expect(await subject().source.createdAt(subject().root, "never")).toBeNull();
    });
  });
}
