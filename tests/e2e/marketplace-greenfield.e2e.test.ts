import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

const EMPTY_MANIFEST = {
  version: 5,
  tools: {},
  marketplaces: {},
};

async function seedManifest(projectDir: string, data: unknown = EMPTY_MANIFEST): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(join(projectDir, AIDD_DIR, "manifest.json"), JSON.stringify(data), "utf-8");
}

describe.concurrent("E2E: marketplace greenfield — bundled asset install", () => {
  it("ai install claude writes settings.json and manifest from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-claude");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ai", "install", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
      expect(existsSync(join(projectDir, AIDD_DIR, "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ai install vscode writes .vscode/settings.json from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-vscode");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ide", "install", "vscode"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed vscode");
      expect(existsSync(join(projectDir, ".vscode", "settings.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ai install cursor writes .cursor directory from bundled assets", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-cursor");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ai", "install", "cursor"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed cursor");
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ai install claude is idempotent — second run warns already installed", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-idempotent");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir);

      const { stderr, exitCode } = await runCli(["ai", "install", "claude"], projectDir);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("already installed");
    } finally {
      await cleanup();
    }
  });

  it("ai install claude --force reinstalls over existing files", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-force");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir);

      const { stdout, exitCode } = await runCli(["ai", "install", "claude", "--force"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
    } finally {
      await cleanup();
    }
  });

  it("manifest tracks installed files after ai install claude", async () => {
    const { projectDir, cleanup } = await createTestEnv("greenfield-manifest");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir);

      const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as { tools: Record<string, unknown> };

      expect(manifest.tools).toHaveProperty("claude");
    } finally {
      await cleanup();
    }
  });
});
