import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedEmptyManifest } from "../helpers/project-state.js";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

async function modifyFirstTrackedFile(projectDir: string, toolId: string): Promise<void> {
  const manifestPath = join(projectDir, AIDD_DIR, "manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(manifestRaw) as {
    version: number;
    tools: Record<string, { files: Array<{ relativePath: string }> }>;
  };
  const toolFiles = manifest.tools?.[toolId]?.files ?? [];
  const firstFile = toolFiles[0];
  if (!firstFile) throw new Error(`No ${toolId} files in manifest — install may have failed`);
  const filePath = join(projectDir, firstFile.relativePath);
  await mkdir(join(filePath, ".."), { recursive: true });
  await writeFile(filePath, "user-modified content for conflict test");
}

// Bare `aidd update` is self-update and touches no tracked file, so the project-wide sweep
// under test is `framework update` without `--tool`.
describe.concurrent("E2E: update conflict guard", () => {
  it("exits 1 when a tracked AI tool file is modified in non-TTY mode (no --force)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("update-guard-ai-exit1");
    try {
      await seedEmptyManifest(projectDir);
      await runCli(["framework", "install", "--tool", "claude"], projectDir, fakeHome);
      await modifyFirstTrackedFile(projectDir, "claude");

      const { exitCode, stderr } = await runCli(
        ["framework", "update", "--tool", "claude"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toMatch(/force|non-interactive/);
    } finally {
      await cleanup();
    }
  });
});
