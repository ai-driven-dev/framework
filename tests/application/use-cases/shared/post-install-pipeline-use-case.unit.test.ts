import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PostInstallPipelineUseCase } from "../../../../src/application/use-cases/shared/post-install-pipeline-use-case.js";
import {
  buildUnitDeps,
  initAndInstall,
} from "../../../helpers/ports/build-unit-deps.js";

const PROJECT_ROOT = "/test-project";

describe("post-install pipeline", () => {
  it("saves manifest, generates catalog, updates gitignore after file write", async () => {
    const deps = await buildUnitDeps(PROJECT_ROOT);
    await initAndInstall(deps, PROJECT_ROOT, "claude");

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    await new PostInstallPipelineUseCase(deps.fs, deps.manifestRepo).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
      docsDir: "aidd_docs",
    });

    // manifest saved
    const reloaded = await deps.manifestRepo.load();
    expect(reloaded).not.toBeNull();

    // catalog generated
    const catalogPath = join(PROJECT_ROOT, "aidd_docs", "CATALOG.md");
    expect(deps.fs.has(catalogPath)).toBe(true);
    const catalogContent = deps.fs.getFile(catalogPath) ?? "";
    expect(catalogContent.length).toBeGreaterThan(0);

    // gitignore updated
    const gitignorePath = join(PROJECT_ROOT, ".gitignore");
    expect(deps.fs.has(gitignorePath)).toBe(true);
    const gitignoreContent = deps.fs.getFile(gitignorePath) ?? "";
    expect(gitignoreContent).toContain(".aidd/cache/");
  });
});
