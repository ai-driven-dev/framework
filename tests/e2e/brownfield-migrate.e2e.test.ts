import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

const BUNDLED_PLUGIN = {
  name: "aidd-context",
  source: { kind: "local", path: "plugins/aidd-context" },
  version: "1.0.0",
  strict: false,
  files: {},
};

const MANIFEST_WITH_BUNDLED_PLUGIN = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {
    claude: {
      toolId: "claude",
      version: "1.0.0",
      files: [],
      plugins: [BUNDLED_PLUGIN],
    },
  },
  scripts: null,
  plugins: null,
  mode: "local",
};

const MANIFEST_WITH_BUNDLED_PLUGIN_AND_SCRIPTS = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {
    claude: {
      toolId: "claude",
      version: "1.0.0",
      files: [],
      plugins: [BUNDLED_PLUGIN],
    },
  },
  scripts: {
    version: "1.0.0",
    files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
  },
  plugins: null,
  mode: "local",
};

async function seedManifest(projectDir: string, data: unknown): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(join(projectDir, AIDD_DIR, "manifest.json"), JSON.stringify(data), "utf-8");
}

async function readManifest(projectDir: string): Promise<Record<string, unknown>> {
  const raw = await readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe.concurrent("E2E: marketplace brownfield migrate", () => {
  it("detects and strips bundled plugin from tool manifest entry", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-bundled");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN);

      const { stdout, exitCode } = await runCli(
        ["migrate", "--non-interactive"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Migration complete");
      const manifest = await readManifest(projectDir);
      const tools = manifest.tools as Record<string, { plugins?: unknown[] }>;
      expect(tools.claude.plugins ?? []).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("creates manifest backup before writing", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-backup");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN);

      await runCli(["migrate", "--non-interactive"], projectDir, fakeHome);

      const { readdir } = await import("node:fs/promises");
      const files = await readdir(join(projectDir, AIDD_DIR));
      expect(files.some((f) => f.includes("manifest.json.bak."))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("dry-run shows plan but does not strip bundled plugin", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-dry-run");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN);

      const { stdout, exitCode } = await runCli(
        ["migrate", "--dry-run", "--non-interactive"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dry-run complete");
      const manifest = await readManifest(projectDir);
      const tools = manifest.tools as Record<string, { plugins: unknown[] }>;
      expect(tools.claude.plugins).toHaveLength(1);
    } finally {
      await cleanup();
    }
  });

  it("strips both bundled plugin and obsolete scripts in single run", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-combined");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN_AND_SCRIPTS);

      const { stdout, exitCode } = await runCli(
        ["migrate", "--non-interactive"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Migration complete");
      const manifest = await readManifest(projectDir);
      // After migration, scripts field is absent (stripped by toJSON round-trip)
      expect("scripts" in manifest ? manifest.scripts : null).toBeFalsy();
      const tools = manifest.tools as Record<string, { plugins?: unknown[] }>;
      expect(tools.claude.plugins ?? []).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });

  it("non-TTY auto-prompt: other commands exit 1 with hint when manifest is outdated (#198)", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-auto-prompt");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN);
      const { stderr, exitCode } = await runCli(["ai", "list"], projectDir, fakeHome);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Outdated manifest detected");
      expect(stderr).toContain("aidd migrate");
    } finally {
      await cleanup();
    }
  });

  it("is idempotent — second run reports nothing to migrate", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("brownfield-idempotent");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_BUNDLED_PLUGIN);
      await runCli(["migrate", "--non-interactive"], projectDir, fakeHome);

      const { stdout, exitCode } = await runCli(
        ["migrate", "--non-interactive"],
        projectDir,
        fakeHome
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to migrate");
    } finally {
      await cleanup();
    }
  });
});
