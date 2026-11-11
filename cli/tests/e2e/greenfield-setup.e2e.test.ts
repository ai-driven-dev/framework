import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedEmptyManifest } from "../helpers/project-state.js";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

describe.concurrent("E2E: aidd framework install --tool — individual tool install", () => {
  it("framework install --tool claude writes settings.json and manifest from bundled assets", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-claude");
    try {
      await seedEmptyManifest(projectDir);

      const { stdout, exitCode } = await runCli(
        ["framework", "install", "--tool", "claude"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
      const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as { tools: Record<string, unknown> };
      expect(manifest.tools).toHaveProperty("claude");
    } finally {
      await cleanup();
    }
  });
});
