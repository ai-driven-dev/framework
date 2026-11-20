import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RunPostInstallPipeline } from "../../../../../src/contexts/installation/application/install/run-post-install-pipeline.js";
import { UpdateGitignore } from "../../../../../src/contexts/installation/application/update-gitignore.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { buildInstallationDeps, initAndInstall } from "../../testing/installation-deps.builder.js";

const PROJECT_ROOT = "/test-project";

/** Records every `execute` call so a test can assert the pipeline batches its gitignore
 * entries into one call instead of writing the same file twice. */
class RecordingGitignoreUseCase extends UpdateGitignore {
  readonly calls: string[][] = [];

  override async execute(projectRoot: string, entries: string[]): Promise<boolean> {
    this.calls.push(entries);
    return super.execute(projectRoot, entries);
  }
}

describe("post-install pipeline", () => {
  it("saves manifest and updates gitignore after file write", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);

    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    await new RunPostInstallPipeline(
      deps.manifestRepo,
      deps.updateGitignore,
      registeredTools()
    ).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
    });

    const reloaded = await deps.manifestRepo.load();
    expect(reloaded).not.toBeNull();

    const gitignorePath = join(PROJECT_ROOT, ".gitignore");
    expect(deps.fs.has(gitignorePath)).toBe(true);
    const gitignoreContent = deps.fs.getFile(gitignorePath) ?? "";
    expect(gitignoreContent).toContain(".aidd/cache/");
  });

  it("calls gitignore exactly once, with all three families of entries", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    const recordingGitignore = new RecordingGitignoreUseCase(deps.fs);
    await new RunPostInstallPipeline(
      deps.manifestRepo,
      recordingGitignore,
      registeredTools()
    ).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
    });

    expect(recordingGitignore.calls).toHaveLength(1);
    expect(recordingGitignore.calls[0]).toEqual(
      expect.arrayContaining([".aidd/cache/", ".claude/settings.local.json"])
    );
  });

  it("ignores the cache, and nothing wider than aidd_docs", async () => {
    const deps = await buildInstallationDeps();
    await initAndInstall(deps, PROJECT_ROOT, TOOL.claude);
    const manifest = await deps.manifestRepo.load();
    if (manifest === null) throw new Error("manifest not found");

    await new RunPostInstallPipeline(
      deps.manifestRepo,
      deps.updateGitignore,
      registeredTools()
    ).execute({
      projectRoot: PROJECT_ROOT,
      manifest,
    });

    const gitignoreContent = deps.fs.getFile(join(PROJECT_ROOT, ".gitignore")) ?? "";
    expect(gitignoreContent).toContain(".aidd/cache/");
    expect(gitignoreContent).not.toContain("aidd_docs/*");
    expect(gitignoreContent).not.toMatch(/^aidd_docs\/$/mu);
  });
});
