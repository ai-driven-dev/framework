import { describe, expect, it } from "vitest";
import { AssertProjectRemovable } from "../../../../../src/contexts/installation/application/clean/assert-project-removable.use-case.js";
import { CleanProjectFiles } from "../../../../../src/contexts/installation/application/clean/clean-project-files.use-case.js";
import { PlanProjectClean } from "../../../../../src/contexts/installation/application/clean/plan-project-clean.use-case.js";
import { RemoveProjectFiles } from "../../../../../src/contexts/installation/application/removal/project/remove-project-files.js";
import { UpdateGitignore } from "../../../../../src/contexts/installation/application/update-gitignore.use-case.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../../../shared/testing/in-memory-manifest-repository.fake.js";
import { registeredTools } from "../../../../shared/testing/registered-tools.builder.js";

const ROOT = "/test-project";

function cleanOverEmptyProject(): CleanProjectFiles {
  const fs = new InMemoryFileAdapter();
  const manifestRepo = new InMemoryManifestRepository(null, ROOT);
  const asks = { homeDir: () => "/home", assertMcpRemovable: async () => undefined };
  return new CleanProjectFiles({
    assertProjectRemovable: new AssertProjectRemovable(
      { fs, manifestRepo, assertMcpRemovable: asks.assertMcpRemovable },
      registeredTools()
    ),
    planProjectClean: new PlanProjectClean({ manifestRepo, asks }, registeredTools()),
    removeProjectFiles: new RemoveProjectFiles(
      {
        fs,
        manifestRepo,
        logger: new CapturingLogger(),
        updateGitignore: new UpdateGitignore(fs),
        homedir: () => "/home/dev",
      },
      registeredTools()
    ),
  });
}

describe("CleanProjectFiles over a project that installed nothing", () => {
  it("plans nothing", async () => {
    const records = {
      pluginRefsOf: () => [],
      refOf: () => undefined,
      registrationPreview: () => ({
        binary: "",
        marketplaceCount: 0,
        pluginRefCount: 0,
        cachePaths: [],
      }),
    };

    await expect(cleanOverEmptyProject().execute({ kind: "plan", records })).resolves.toBeNull();
  });

  it("proves nothing removable", async () => {
    await expect(
      cleanOverEmptyProject().execute({
        kind: "assert-removable",
        projectRoot: ROOT,
        force: false,
      })
    ).resolves.toBeUndefined();
  });

  it("removes no file", async () => {
    await expect(
      cleanOverEmptyProject().execute({ kind: "remove", projectRoot: ROOT, force: false })
    ).resolves.toBe(0);
  });
});
