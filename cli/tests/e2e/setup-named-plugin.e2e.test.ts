import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { seedEmptyManifest } from "../presentation/testing/project-state.js";
import { createTestEnv, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");

describe.concurrent("setup with a named plugin from a local source", () => {
  it("installs aidd-context under claude", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("setup-named-plugin");
    try {
      await seedEmptyManifest(projectDir);

      const { exitCode, stderr } = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ai",
          "claude",
          "--plugins",
          "aidd-context",
          "--yes",
        ],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stderr).not.toContain("local path does not exist");

      const raw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as {
        tools: Record<string, { plugins?: Array<{ name: string }> }>;
      };
      const claudePlugins = manifest.tools.claude?.plugins ?? [];
      expect(claudePlugins.map((p) => p.name)).toContain("aidd-context");
    } finally {
      await cleanup();
    }
  });
});
