import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import type { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { PROJECT_ROOT, seedTrackedFiles } from "../testing/clean-project.builder.js";
import { projectCleanerDeps } from "../testing/project-cleaner.builder.js";
import { HOST, hostCatalog } from "../testing/synthetic-hosts.builder.js";

function previewOver(fs: InMemoryFileAdapter, manifest: Manifest | null) {
  return projectCleanerDeps({
    tools: hostCatalog(),
    fs,
    manifestRepo: new InMemoryManifestRepository(manifest, PROJECT_ROOT),
    logger: new CapturingLogger(),
    gitignore: new UpdateGitignore(fs),
  }).preview;
}

describe("previewing what a project clean would remove", () => {
  it("is null when the project has no manifest", async () => {
    const preview = previewOver(new InMemoryFileAdapter({}, [PROJECT_ROOT]), null);

    await expect(preview.execute({ projectRoot: PROJECT_ROOT })).resolves.toBeNull();
  });

  it("shows the files each tool would lose and that nothing else references the source", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const preview = previewOver(fs, seedTrackedFiles(HOST, fs, ["a.md", "b.md"]));

    const result = await preview.execute({ projectRoot: PROJECT_ROOT });

    expect(result?.preview.tools).toStrictEqual([{ toolId: HOST.claude, fileCount: 2 }]);
    expect(result?.preview.totalFileCount).toBe(2);
    expect(result?.preview.sharedSourceOtherProjects).toBeUndefined();
    expect(result?.plan.tools).toBe(result?.preview.tools);
  });
});
