import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

const EMPTY_MANIFEST = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: null,
  plugins: null,
  mode: "local",
};

async function seedManifest(projectDir: string, data: unknown = EMPTY_MANIFEST): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(join(projectDir, AIDD_DIR, "manifest.json"), JSON.stringify(data), "utf-8");
}

describe.concurrent("E2E: marketplace greenfield — bundled asset install", () => {
  it("install ai claude writes settings.json and manifest from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-claude");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["install", "ai", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
      expect(existsSync(join(projectDir, AIDD_DIR, "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("install ide vscode writes .vscode/settings.json from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-vscode");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["install", "ide", "vscode"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed vscode");
      expect(existsSync(join(projectDir, ".vscode", "settings.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("install ai cursor writes .cursor/rules from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-cursor");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["install", "ai", "cursor"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed cursor");
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("install ai claude is idempotent — second run skips", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-idempotent");
    try {
      await seedManifest(projectDir);
      await runCli(["install", "ai", "claude"], projectDir);

      const { stderr, exitCode } = await runCli(["install", "ai", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("already installed");
    } finally {
      await cleanup();
    }
  });

  it("install ai claude --force reinstalls over existing files", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-force");
    try {
      await seedManifest(projectDir);
      await runCli(["install", "ai", "claude"], projectDir);

      const { stdout, exitCode } = await runCli(["install", "ai", "claude", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
    } finally {
      await cleanup();
    }
  });

  it("manifest tracks installed files after install ai claude", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-manifest");
    try {
      await seedManifest(projectDir);
      await runCli(["install", "ai", "claude"], projectDir);

      const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as { tools: Record<string, unknown> };

      expect(manifest.tools).toHaveProperty("claude");
    } finally {
      await cleanup();
    }
  });
});
