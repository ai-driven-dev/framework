import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const AIDD_DIR = ".aidd";

const MANIFEST_WITH_SCRIPTS = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: {
    version: "1.0.0",
    files: [{ relativePath: "scripts/build.sh", hash: "a".repeat(32) }],
  },
  plugins: null,
  mode: "local",
};

const MANIFEST_WITH_PLUGINS_SECTION = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: null,
  plugins: { version: "1.0.0", files: [] },
  mode: "local",
};

const CLEAN_MANIFEST = {
  version: 5,
  docsDir: "aidd_docs",
  tools: {},
  scripts: null,
  plugins: null,
  mode: "local",
};

async function seedManifest(projectDir: string, data: unknown): Promise<void> {
  await mkdir(join(projectDir, AIDD_DIR), { recursive: true });
  await writeFile(join(projectDir, AIDD_DIR, "manifest.json"), JSON.stringify(data), "utf-8");
}

describe.concurrent("E2E: aidd migrate", () => {
  it("reports nothing to migrate on clean project", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      await seedManifest(projectDir, CLEAN_MANIFEST);

      const { stdout, exitCode } = await runCli(["migrate", "--non-interactive"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to migrate");
    } finally {
      await cleanup();
    }
  });

  it("dry-run shows plan without applying changes", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_SCRIPTS);

      const { stdout, exitCode } = await runCli(
        ["migrate", "--dry-run", "--non-interactive"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Dry-run complete");
      const manifest = JSON.parse(
        await import("node:fs/promises").then((fs) =>
          fs.readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8")
        )
      ) as Record<string, unknown>;
      expect(manifest.scripts).not.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("strips obsolete scripts section", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_SCRIPTS);

      const { stdout, exitCode } = await runCli(["migrate", "--non-interactive"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Migration complete");
      const manifest = JSON.parse(
        await import("node:fs/promises").then((fs) =>
          fs.readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8")
        )
      ) as Record<string, unknown>;
      expect(manifest.scripts).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("strips obsolete top-level plugins section", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_PLUGINS_SECTION);

      const { stdout, exitCode } = await runCli(["migrate", "--non-interactive"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Migration complete");
      const manifest = JSON.parse(
        await import("node:fs/promises").then((fs) =>
          fs.readFile(join(projectDir, AIDD_DIR, "manifest.json"), "utf-8")
        )
      ) as Record<string, unknown>;
      expect(manifest.plugins).toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("is idempotent — second run reports nothing to migrate", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      await seedManifest(projectDir, MANIFEST_WITH_SCRIPTS);
      await runCli(["migrate", "--non-interactive"], projectDir);

      const { stdout, exitCode } = await runCli(["migrate", "--non-interactive"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to migrate");
    } finally {
      await cleanup();
    }
  });

  it("exits 0 when no manifest exists", async () => {
    const { projectDir, cleanup } = await createTestEnv("migrate");
    try {
      const { stdout, exitCode } = await runCli(["migrate", "--non-interactive"], projectDir);

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Nothing to migrate");
    } finally {
      await cleanup();
    }
  });
});
