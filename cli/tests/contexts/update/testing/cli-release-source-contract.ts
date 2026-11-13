import { afterEach, describe, expect, it } from "vitest";
import type { CliReleaseSource } from "../../../../src/contexts/update/ports/cli-release-source.js";
import { FrameworkResolutionError } from "../../../../src/shared/domain/errors.js";

/** What one scenario asks of a subject: where the latest release is announced. */
export type ReleaseScenario =
  /** The latest release is this version; its notes are readable or not. */
  | { kind: "published"; version: string; notes: string | null }
  /** The registry cannot be reached. */
  | { kind: "unreachable" }
  /** The registry answers something that names no version. */
  | { kind: "malformed" };

export interface ReleaseSubject {
  readonly source: CliReleaseSource;
  dispose(): Promise<void>;
}

/** What a source of the CLI's releases promises. The URLs and headers it asks with are the
 * adapter's translation, tested there. */
export function describeCliReleaseSourceContract(
  subjectName: string,
  makeSubject: (scenario: ReleaseScenario) => Promise<ReleaseSubject>
): void {
  describe(`when the release source is ${subjectName}`, () => {
    const opened: ReleaseSubject[] = [];

    afterEach(async () => {
      for (const subject of opened.splice(0)) await subject.dispose();
    });

    async function given(scenario: ReleaseScenario): Promise<CliReleaseSource> {
      const subject = await makeSubject(scenario);
      opened.push(subject);
      return subject.source;
    }

    it("answers the latest version with its notes", async () => {
      const source = await given({ kind: "published", version: "5.1.2", notes: "## changes" });

      expect(await source.fetchLatestRelease()).toStrictEqual({
        version: "5.1.2",
        changelog: "## changes",
      });
    });

    it("answers the version with no notes when they cannot be read", async () => {
      const source = await given({ kind: "published", version: "5.1.2", notes: null });

      expect(await source.fetchLatestRelease()).toStrictEqual({
        version: "5.1.2",
        changelog: null,
      });
    });

    it("refuses when the registry is unreachable or names no version", async () => {
      for (const kind of ["unreachable", "malformed"] as const) {
        await expect((await given({ kind })).fetchLatestRelease()).rejects.toBeInstanceOf(
          FrameworkResolutionError
        );
      }
    });
  });
}
