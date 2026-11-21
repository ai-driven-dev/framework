import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";

export interface UserSourceReferencesSubject {
  readonly references: UserSourceReferences;
  /** A project directory that exists, by name. */
  project(name: string): Promise<string>;
  /** Removes a project directory made by `project`. */
  vanish(root: string): Promise<void>;
  dispose(): Promise<void>;
}

/** What the project references promise, stated once and run against every implementation of them. */
export function describeUserSourceReferencesContract(
  subjectName: string,
  makeSubject: () => Promise<UserSourceReferencesSubject>
): void {
  describe(`when the project references are kept ${subjectName}`, () => {
    let subject: UserSourceReferencesSubject;
    beforeEach(async () => {
      subject = await makeSubject();
    });
    afterEach(async () => {
      await subject.dispose();
    });

    it("lists no project before any is added", async () => {
      expect(await subject.references.listAllReferencingProjects()).toEqual([]);
    });

    it("lists two projects added under the same version", async () => {
      const a = await subject.project("a");
      const b = await subject.project("b");
      await subject.references.addReference("1.0.0", a);
      await subject.references.addReference("1.0.0", b);

      expect([...(await subject.references.listAllReferencingProjects())].sort()).toEqual(
        [a, b].sort()
      );
    });

    it("lists a project once when it is added again, under the same or another version", async () => {
      const a = await subject.project("a");
      await subject.references.addReference("1.0.0", a);
      await subject.references.addReference("1.0.0", a);
      await subject.references.addReference("2.0.0", a);

      expect(await subject.references.listAllReferencingProjects()).toEqual([a]);
    });

    it("drops a project's reference wherever it is recorded, and keeps the others", async () => {
      const a = await subject.project("a");
      const b = await subject.project("b");
      await subject.references.addReference("1.0.0", a);
      await subject.references.addReference("2.0.0", b);
      await subject.references.removeReference(a);

      expect(await subject.references.listAllReferencingProjects()).toEqual([b]);
    });

    it("removes a project that holds no reference without a trace", async () => {
      const a = await subject.project("a");
      await subject.references.addReference("1.0.0", a);
      await subject.references.removeReference(await subject.project("other"));

      expect(await subject.references.listAllReferencingProjects()).toEqual([a]);
    });

    it("ignores a project whose directory is gone", async () => {
      const a = await subject.project("a");
      const b = await subject.project("b");
      await subject.references.addReference("1.0.0", a);
      await subject.references.addReference("1.0.0", b);
      await subject.vanish(a);

      expect(await subject.references.listAllReferencingProjects()).toEqual([b]);
    });
  });
}
