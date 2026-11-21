import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "../shared/testing/cli-sandbox.builder.js";

describe("aidd translate", () => {
  it("--to claude exits 0 and emits the marketplace, the plugin manifest and the agents", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-claude");
    try {
      const outDir = join(tempDir, "dist-claude");
      await mkdir(outDir, { recursive: true });
      const build = await runCli(
        ["translate", FRAMEWORK_PATH, "--to", "claude", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);
      expect(build.stdout).toContain("Built");
      expect(existsSync(join(outDir, ".claude-plugin", "marketplace.json"))).toBe(true);
      expect(
        existsSync(join(outDir, "plugins", "aidd-test", ".claude-plugin", "plugin.json"))
      ).toBe(true);
      expect(existsSync(join(outDir, "plugins", "aidd-test", "agents", "code-reviewer.md"))).toBe(
        true
      );
    } finally {
      await cleanup();
    }
  });
});
