import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UpdateGitignore } from "../../../src/contexts/installation/application/update-gitignore.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { HasherAdapter } from "../../../src/contexts/installation/infrastructure/hasher-adapter.js";
import type { CleanProject } from "../../../src/orchestration/clean/clean-project.js";
import { FileAdapter } from "../../../src/shared/infrastructure/file-adapter.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";
import { InMemoryManifestRepository } from "../../helpers/ports/in-memory-manifest-repository.js";
import { projectCleaner } from "../../helpers/project-cleaner.js";
import { TOOL } from "../../shared/testing/registered-tools.js";

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), "aidd-clean-aidd-dir-"));
});

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

function buildUseCase(logger: CapturingLogger): CleanProject {
  const fs = new FileAdapter(new HasherAdapter(), logger);
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "1.0.0", []);
  manifest.addTool(TOOL.vscode, "1.0.0", []);
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
