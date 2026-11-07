import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd translate", () => {
  it("AC #10: invalid plugin.json halts the build with non-zero exit", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-build-invalid");
    try {
      const { writeFile, mkdir, cp } = await import("node:fs/promises");
      const sourceDir = join(tempDir, "source");
      await cp(FRAMEWORK_PATH, sourceDir, { recursive: true });

      const manifestPath = join(sourceDir, "plugins", "aidd-test", ".claude-plugin", "plugin.json");
      await mkdir(join(sourceDir, "plugins", "aidd-test", ".claude-plugin"), { recursive: true });
      await writeFile(manifestPath, JSON.stringify({ version: "1.0.0" }), "utf-8");

      const outDir = join(tempDir, "dist");
      const result = await runCli(
        ["translate", sourceDir, "--to", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toBeTruthy();
    } finally {
      await cleanup();
    }
  });

  it("flat AC #1: --flat writes agents, skills, hooks, mcp under canonical paths", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-flat-tree");
    try {
      const projRoot = join(tempDir, "proj");
      await mkdir(projRoot, { recursive: true });

      const build = await runCli(
        ["translate", FRAMEWORK_PATH, "--to", "copilot", "--as", "flat", "--out", projRoot],
        projectDir,
        fakeHome
      );
      expect(build.exitCode).toBe(0);
      expect(build.stdout).toContain("Flat-installed");

      // flat agents use plugin-prefixed leaf name for collision-free discoverability
      expect(
        existsSync(join(projRoot, ".github", "agents", "aidd-test-code-reviewer.agent.md"))
      ).toBe(true);
      // flat skills use plugin-prefixed folder name for collision-free discoverability
      expect(existsSync(join(projRoot, ".github", "skills", "aidd-test-commit", "SKILL.md"))).toBe(
        true
      );
      expect(existsSync(join(projRoot, ".github", "hooks", "aidd-test.hooks.json"))).toBe(true);
      expect(existsSync(join(projRoot, ".vscode", "mcp.json"))).toBe(true);
      expect(existsSync(join(projRoot, ".github", "plugin", "marketplace.json"))).toBe(false);

      // Agent frontmatter is restricted to Copilot's own allowlist.
      const COPILOT_ALLOWED_KEYS = new Set([
        "name",
        "description",
        "model",
        "reasoningEffort",
        "include-custom-instructions",
      ]);
      const agentContent = await readFile(
        join(projRoot, ".github", "agents", "aidd-test-code-reviewer.agent.md"),
        "utf-8"
      );
      const fmMatch = agentContent.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fmKeys = fmMatch[1]
          .split("\n")
          .map((l) => l.split(":")[0].trim())
          .filter(Boolean);
        for (const key of fmKeys) {
          expect(COPILOT_ALLOWED_KEYS.has(key)).toBe(true);
        }
      }
    } finally {
      await cleanup();
    }
  });

  it("claude AC #1: --target claude exits 0, emits marketplace + plugin manifest + agents", async () => {
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
      expect(build.stdout).toContain("files written to");

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

  it("AC #7: --target opencode (non-flat) exits 1 with unsupported error", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-opencode-no-flat");
    try {
      const outDir = join(tempDir, "dist");
      const result = await runCli(
        ["translate", FRAMEWORK_PATH, "--to", "opencode", "--out", outDir],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toMatch(/Unsupported target.mode/i);
    } finally {
      await cleanup();
    }
  });
});

describe.concurrent("E2E: aidd translate — marketplace mode never erases what it did not write", () => {
  it("refuses a non-empty --out without --force, and leaves the foreign file untouched", async () => {
    const { tempDir, projectDir, fakeHome, cleanup } = await createTestEnv("fw-market-preserve");
    try {
      const outDir = join(tempDir, "dist");
      await mkdir(outDir, { recursive: true });
      const keepPath = join(outDir, "keep.txt");
      await writeFile(keepPath, "keepme", "utf-8");

      const build = await runCli(
        ["translate", FRAMEWORK_PATH, "--to", "copilot", "--out", outDir],
        projectDir,
        fakeHome
      );

      expect(build.exitCode).not.toBe(0);
      expect(build.stderr).toContain(outDir);
      expect(build.stderr).toContain("--force");
      expect(existsSync(keepPath)).toBe(true);
      expect(await readFile(keepPath, "utf-8")).toBe("keepme");
    } finally {
      await cleanup();
    }
  });
});
