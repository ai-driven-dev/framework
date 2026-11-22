import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { PROJECT_ROOT, seedTrackedFiles } from "../testing/clean-project.builder.js";
import { projectCleanerDeps } from "../testing/project-cleaner.builder.js";
import { HOST, hostCatalog } from "../testing/synthetic-hosts.builder.js";

describe("removing a project that is cleaned", () => {
  it("removes the planned files and counts them", async () => {
    const fs = new InMemoryFileAdapter({}, [PROJECT_ROOT]);
    const manifest = seedTrackedFiles(HOST, fs, ["a.md", "b.md"]);
    const deps = projectCleanerDeps({
      tools: hostCatalog(),
      fs,
      manifestRepo: new InMemoryManifestRepository(manifest, PROJECT_ROOT),
      logger: new CapturingLogger(),
      gitignore: new UpdateGitignore(fs),
    });
    const previewed = await deps.preview.execute({ projectRoot: PROJECT_ROOT });
    if (previewed === null) throw new Error("the seeded project has a manifest");

    const count = await deps.remove.execute({
      plan: previewed.plan,
      projectRoot: PROJECT_ROOT,
      force: true,
    });

    expect(count).toBe(2);
    expect(fs.has(join(PROJECT_ROOT, "a.md"))).toBe(false);
    expect(fs.has(join(PROJECT_ROOT, "b.md"))).toBe(false);
  });
});
