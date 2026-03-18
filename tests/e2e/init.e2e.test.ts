import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd init", () => {
  it("creates the docs directory and manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      const { stdout, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Initialized docs in aidd_docs/");
      expect(existsSync(join(projectDir, "aidd_docs"))).toBe(true);
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("creates a custom docs directory when --docs-dir is specified", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      const { stdout, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH, "--docs-dir", "my_docs"],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Initialized docs in my_docs/");
      expect(existsSync(join(projectDir, "my_docs"))).toBe(true);

      const manifestRaw = await readFile(join(projectDir, ".aidd", "manifest.json"), "utf-8");
      const manifest = JSON.parse(manifestRaw) as { docsDir?: string };
      expect(manifest.docsDir).toBe("my_docs");
    } finally {
      await cleanup();
    }
  });

  it("shows an error when the docs-dir name contains invalid characters", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH, "--docs-dir", "my docs!"],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Invalid directory name");
    } finally {
      await cleanup();
    }
  });

  it("shows an error when the docs directory already exists without a manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await mkdir(join(projectDir, "aidd_docs"), { recursive: true });

      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("AIDD files detected but no manifest found");
      expect(stderr).toContain("aidd adopt --from");
    } finally {
      await cleanup();
    }
  });

  it("shows an error when .claude/ exists without a manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await mkdir(join(projectDir, ".claude", "commands", "aidd", "04"), { recursive: true });
      await writeFile(
        join(projectDir, ".claude", "commands", "aidd", "04", "implement.md"),
        "---\nname: 'aidd:04:implement'\ndescription: Implement a plan\n---\n\n# Implement\n"
      );

      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("AIDD files detected but no manifest found");
      expect(stderr).toContain("aidd adopt --from");
    } finally {
      await cleanup();
    }
  });

  it("shows an error when .opencode/ exists without a manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await mkdir(join(projectDir, ".opencode", "commands", "aidd", "04"), { recursive: true });
      await writeFile(
        join(projectDir, ".opencode", "commands", "aidd", "04", "implement.md"),
        "---\nname: 'aidd:04:implement'\ndescription: Implement a plan\n---\n\n# Implement\n"
      );

      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("AIDD files detected but no manifest found");
      expect(stderr).toContain("aidd adopt --from");
      expect(stderr).toContain("Check available tags for:");
    } finally {
      await cleanup();
    }
  });

  it("shows an error when AGENTS.md exists without a manifest", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await mkdir(join(projectDir, ".claude", "commands", "aidd", "04"), { recursive: true });
      await writeFile(
        join(projectDir, ".claude", "commands", "aidd", "04", "implement.md"),
        "---\nname: 'aidd:04:implement'\ndescription: Implement a plan\n---\n\n# Implement\n"
      );
      await writeFile(join(projectDir, "AGENTS.md"), "# Agents");

      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("AIDD files detected but no manifest found");
      expect(stderr).toContain("aidd adopt --from");
      expect(stderr).toContain("Check available tags for:");
    } finally {
      await cleanup();
    }
  });

  it("succeeds when only .aidd/cache/ exists from a previous interrupted run", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await mkdir(join(projectDir, ".aidd", "cache"), { recursive: true });

      const { stdout, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Initialized docs in aidd_docs/");
      expect(existsSync(join(projectDir, ".aidd", "manifest.json"))).toBe(true);
    } finally {
      await cleanup();
    }
  });

  it("fails with guidance when already initialized without --force", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["init", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("Already initialized");
      expect(stderr).toContain("aidd init --force");
    } finally {
      await cleanup();
    }
  });

  it("re-copies docs templates with --force on existing installation", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { stdout, exitCode } = await runCli(
        ["init", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).toBe(0);
      expect(stdout).toContain("Initialized docs in aidd_docs/");
    } finally {
      await cleanup();
    }
  });

  it("fails with guidance when --force is used without prior init", async () => {
    const { projectDir, cleanup } = await createTestEnv("init");
    try {
      const { stderr, exitCode } = await runCli(
        ["init", "--force", "--framework", FRAMEWORK_PATH],
        projectDir
      );

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain("No AIDD manifest found");
    } finally {
      await cleanup();
    }
  });
});
