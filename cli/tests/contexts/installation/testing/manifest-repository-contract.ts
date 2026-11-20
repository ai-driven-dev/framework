import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ManifestRepository } from "../../../../src/contexts/installation/ports/manifest-repository.js";
import { FileHash, InstallationFile } from "../../../../src/shared/domain/file.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { aManifest } from "./manifest-builder.js";

/** What a contract run needs from one implementation of the repository. */
export interface ManifestRepositorySubject {
  readonly repository: ManifestRepository;
  readonly projectRoot: string;
  dispose(): Promise<void>;
}

const installedFile = new InstallationFile({
  relativePath: ".claude/rules/a.md",
  content: "content",
  hash: new FileHash("a".repeat(32)),
});

const slashed = (path: string): string => path.replaceAll("\\", "/");

/**
 * What the repository promises, stated once and run against every implementation of it. A case
 * red on the real adapter is a wrong case; red on the fake, a lie the fake tells. A document the
 * fake cannot hold stays with the real adapter: it stores objects, never JSON.
 */
export function describeManifestRepositoryContract(
  subjectName: string,
  makeSubject: () => Promise<ManifestRepositorySubject>
): void {
  describe(`when the manifest repository is ${subjectName}`, () => {
    let subject: ManifestRepositorySubject;

    beforeEach(async () => {
      subject = await makeSubject();
    });

    afterEach(async () => {
      await subject.dispose();
    });

    it("loads null when no manifest was saved", async () => {
      expect(await subject.repository.load()).toBeNull();
    });

    it("loads back what was saved", async () => {
      const saved = aManifest().withTool(TOOL.claude, [installedFile]).build();

      await subject.repository.save(saved);

      expect((await subject.repository.load())?.toJSON()).toStrictEqual(saved.toJSON());
    });

    it("loads null once the manifest is deleted", async () => {
      await subject.repository.save(aManifest().build());

      await subject.repository.delete();

      expect(await subject.repository.load()).toBeNull();
    });

    it("names the manifest file under the project root", () => {
      expect(slashed(subject.repository.path)).toBe(
        `${slashed(subject.projectRoot)}/.aidd/manifest.json`
      );
    });
  });
}
