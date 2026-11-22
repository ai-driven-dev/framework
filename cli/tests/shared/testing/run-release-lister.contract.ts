import { afterEach, describe, expect, it } from "vitest";
import { CatalogFetchAuthError } from "../../../src/shared/domain/shared.error.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";

/** The world every subject serves: a repository with releases, one with none, a private one. */
export const RELEASES_REPO = "owner/repo";
export const EMPTY_REPO = "owner/empty";
export const PRIVATE_REPO = "owner/private";
export const RELEASE_TAGS = ["aidd-refine-v1.0.0", "v4.0.0", "v3.9.1", "v3.7.3-pm.1"];
export const NOTES_TAG = "v4.0.0";
export const NOTES = "the notes of v4";
export const NO_NOTES_TAG = "v3.9.1";

export interface ReleaseListerSubject {
  readonly lister: ReleaseLister;
  dispose(): Promise<void>;
}

/** What reading the releases of a repository promises, whatever answers for the forge. */
export function describeReleaseListerContract(
  subjectName: string,
  makeSubject: () => Promise<ReleaseListerSubject>
): void {
  describe(`when releases are read ${subjectName}`, () => {
    const opened: ReleaseListerSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(): Promise<ReleaseLister> {
      const subject = await makeSubject();
      opened.push(subject);
      return subject.lister;
    }

    it("lists every tag in order, component tags included, and leaves the root rule to the domain", async () => {
      const lister = await given();

      expect(await lister.listReleaseTags(RELEASES_REPO)).toEqual(RELEASE_TAGS);
    });

    it("lists nothing for a repository without releases", async () => {
      const lister = await given();

      expect(await lister.listReleaseTags(EMPTY_REPO)).toEqual([]);
    });

    it("refuses with an authentication error to list a repository that needs credentials", async () => {
      const lister = await given();

      await expect(lister.listReleaseTags(PRIVATE_REPO)).rejects.toBeInstanceOf(
        CatalogFetchAuthError
      );
    });

    it("reads the notes of a tagged release", async () => {
      const lister = await given();

      expect(await lister.readReleaseBody(RELEASES_REPO, NOTES_TAG)).toBe(NOTES);
    });

    it("answers null for a release without notes", async () => {
      const lister = await given();

      expect(await lister.readReleaseBody(RELEASES_REPO, NO_NOTES_TAG)).toBeNull();
    });

    it("answers null when the repository has no such release", async () => {
      const lister = await given();

      expect(await lister.readReleaseBody(RELEASES_REPO, "v0.0.0")).toBeNull();
      expect(await lister.readReleaseBody(EMPTY_REPO, NOTES_TAG)).toBeNull();
    });

    it("refuses with an authentication error to read a release that needs credentials", async () => {
      const lister = await given();

      await expect(lister.readReleaseBody(PRIVATE_REPO, NOTES_TAG)).rejects.toBeInstanceOf(
        CatalogFetchAuthError
      );
    });
  });
}
