import { describe, expect, it } from "vitest";
import type { RepositoryVisibility } from "../../../../src/contexts/distribution/ports/repository-visibility.js";

/** The world every subject serves: a public repository, a private (or missing) one, and one
 * whose lookup fails for a reason other than "not found". */
export const VISIBLE_REPO = "owner/visible";
export const HIDDEN_REPO = "owner/hidden";
export const RATE_LIMITED_REPO = "owner/rate-limited";

export interface RepositoryVisibilitySubject {
  readonly visibility: RepositoryVisibility;
  dispose(): Promise<void>;
}

/** What asking whether a repository is public promises, whatever answers for it. */
export function describeRepositoryVisibilityContract(
  subjectName: string,
  makeSubject: () => Promise<RepositoryVisibilitySubject>
): void {
  describe(`when a repository's visibility is asked ${subjectName}`, () => {
    async function answerFor(repo: string): Promise<boolean> {
      const subject = await makeSubject();
      try {
        return await subject.visibility.isRepoPublic(repo);
      } finally {
        await subject.dispose();
      }
    }

    it("says a public repository is public", async () => {
      expect(await answerFor(VISIBLE_REPO)).toBe(true);
    });

    it("says a private or missing repository is not public", async () => {
      expect(await answerFor(HIDDEN_REPO)).toBe(false);
    });

    it("says public when the lookup fails for any reason but not found", async () => {
      expect(await answerFor(RATE_LIMITED_REPO)).toBe(true);
    });
  });
}
