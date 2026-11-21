import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import type { CleanProject } from "../../../src/orchestration/clean/clean-project.js";
import { FileAdapter } from "../../../src/shared/infrastructure/file-adapter.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { CapturingLogger } from "../../shared/testing/capturing-logger.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { projectCleaner } from "../testing/project-cleaner.builder.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "aidd-clean-aidd-dir-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

function buildUseCase(logger: CapturingLogger): CleanProject {
  const fs = new FileAdapter(logger);
  const manifest = aManifest().withTool(TOOL.claude, []).withTool(TOOL.vscode, []).build();
  return projectCleaner({
    fs,
    manifestRepo: new InMemoryManifestRepository(manifest, projectRoot),
    logger,
    gitignore: new UpdateGitignore(fs),
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("clean and the .aidd/ directory itself", () => {
  it("removes .aidd/ once nothing it wrote is left inside, rather than leaving an empty shell", async () => {
    const aiddDir = join(projectRoot, ".aidd");
    await mkdir(join(aiddDir, "cache", "built"), { recursive: true });
    await writeFile(join(aiddDir, "cache", "built", "x.json"), "{}");
    const logger = new CapturingLogger();

    await buildUseCase(logger).execute({
      projectRoot,
      force: true,
    });

    expect(await exists(aiddDir)).toBe(false);
    expect(logger.infoMessages).toStrictEqual([
      "Removing claude files...",
      "Removing vscode files...",
    ]);
  });

  it("finishes cleanly when .aidd/ was already removed by hand before the run", async () => {
    const logger = new CapturingLogger();

    const result = await buildUseCase(logger).execute({
      projectRoot,
      force: true,
    });

    expect(result.fileCount).toBe(0);
    expect(await exists(join(projectRoot, ".aidd"))).toBe(false);
  });
});
