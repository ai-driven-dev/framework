import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";
const EMPTY_MANIFEST = { version: 5, tools: {}, marketplaces: {} };

async function seedManifest(projectDir: string): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(
    join(projectDir, AIDD_DIR, "manifest.json"),
    JSON.stringify(EMPTY_MANIFEST),
    "utf-8"
  );
}

// Tests using `--source remote` clone aidd-framework via real git (HTTPS).
// Slow (clone takes >30s). Gate behind RUN_NETWORK_TESTS=1; bump per-test
// timeout to 180s to accommodate the clone.
const networkAvailable = process.env.RUN_NETWORK_TESTS === "1";
const NETWORK_TIMEOUT_MS = 180_000;

describe.concurrent("E2E: aidd setup greenfield — full setup from empty dir", () => {
  it.skipIf(!networkAvailable)(
    "setup --source remote --all --recommended-plugins --yes installs all tools and writes v5 manifest",
    { timeout: NETWORK_TIMEOUT_MS },
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-setup-all");
      try {
        const { stdout, exitCode } = await runCli(
          ["setup", "--source", "remote", "--all", "--recommended-plugins", "--yes"],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
        expect(stdout).toContain("Installed");

        const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
        const manifest = JSON.parse(raw) as Record<string, unknown>;

        expect(manifest.version).toBe(5);
        expect(manifest).toHaveProperty("tools");
        expect(manifest).toHaveProperty("marketplaces");
        expect(manifest).not.toHaveProperty("mode");
        expect(manifest).not.toHaveProperty("docsDir");
        expect(manifest).not.toHaveProperty("scripts");

        const tools = manifest.tools as Record<string, unknown>;
        expect(tools).toHaveProperty("claude");
        expect(tools).toHaveProperty("cursor");
      } finally {
        await cleanup();
      }
    }
  );

  it.skipIf(!networkAvailable)(
    "setup --source remote --all --yes writes AI and IDE tool files to disk",
    { timeout: NETWORK_TIMEOUT_MS },
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-setup-disk");
      try {
        const { exitCode } = await runCli(
          ["setup", "--source", "remote", "--all", "--yes"],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
        expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
        expect(existsSync(join(projectDir, ".cursor", "settings.json"))).toBe(true);
      } finally {
        await cleanup();
      }
    }
  );

  it.skipIf(!networkAvailable)(
    "setup --source remote --ai claude --yes installs only claude",
    { timeout: NETWORK_TIMEOUT_MS },
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-setup-claude-only");
      try {
        const { stdout, exitCode } = await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--yes"],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
        expect(stdout).toContain("claude");

        const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
        const manifest = JSON.parse(raw) as { tools: Record<string, unknown> };
        expect(manifest.tools).toHaveProperty("claude");
        expect(manifest.tools).not.toHaveProperty("cursor");
      } finally {
        await cleanup();
      }
    }
  );

  it.skipIf(!networkAvailable)(
    "setup is idempotent — second run on already-set-up project exits 0",
    { timeout: NETWORK_TIMEOUT_MS * 2 },
    async () => {
      const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-setup-idempotent");
      try {
        await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--yes"],
          projectDir,
          fakeHome
        );

        const { exitCode } = await runCli(
          ["setup", "--source", "remote", "--ai", "claude", "--yes"],
          projectDir,
          fakeHome
        );

        expect(exitCode).toBe(0);
      } finally {
        await cleanup();
      }
    }
  );
});

describe.concurrent("E2E: aidd ai install — individual tool install", () => {
  it("ai install claude writes settings.json and manifest from bundled assets", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-claude");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
      expect(existsSync(join(projectDir, ".claude", "settings.json"))).toBe(true);
      expect(existsSync(join(projectDir, AIDD_DIR, "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ide install vscode writes .vscode/settings.json from bundled assets", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-vscode");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ide", "install", "vscode"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed vscode");
      expect(existsSync(join(projectDir, ".vscode", "settings.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ai install cursor writes .cursor directory from bundled assets", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-cursor");
    try {
      await seedManifest(projectDir);

      const { stdout, exitCode } = await runCli(["ai", "install", "cursor"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed cursor");
      expect(existsSync(join(projectDir, ".cursor"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("ai install claude is idempotent — second run warns already installed", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-install-idempotent");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      const { stderr, exitCode } = await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      expect(exitCode).toBe(0);
      expect(stderr).toContain("already installed");
    } finally {
      await cleanup();
    }
  });

  it("ai install claude --force reinstalls over existing files", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-force");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      const { stdout, exitCode } = await runCli(
        ["ai", "install", "claude", "--force"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Installed claude");
    } finally {
      await cleanup();
    }
  });

  it("manifest tracks installed files after ai install claude", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("greenfield-manifest");
    try {
      await seedManifest(projectDir);
      await runCli(["ai", "install", "claude"], projectDir, fakeHome);

      const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
      const manifest = JSON.parse(raw) as { tools: Record<string, unknown> };

      expect(manifest.tools).toHaveProperty("claude");
    } finally {
      await cleanup();
    }
  });
});
