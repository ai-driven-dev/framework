import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH, initProject, runCli } from "./helpers.js";

describe.concurrent("E2E: aidd config", () => {
  describe("config list", () => {
    it("fails when no manifest exists", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        const { stderr, exitCode } = await runCli(["config", "list"], projectDir);
        expect(exitCode).toBe(1);
        expect(stderr).toContain("No AIDD manifest found");
      } finally {
        await cleanup();
      }
    });

    it("shows docsDir and tools from manifest", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);
        await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

        const { stdout, exitCode } = await runCli(["config", "list"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout).toContain("docsDir = aidd_docs");
        expect(stdout).toContain("tools   = claude");
      } finally {
        await cleanup();
      }
    });

    it("shows (none) for tools when nothing installed", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stdout, exitCode } = await runCli(["config", "list"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout).toContain("tools   = (none)");
      } finally {
        await cleanup();
      }
    });
  });

  describe("config get", () => {
    it("exits with error when no key is provided in non-interactive mode", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(["config", "get"], projectDir);
        expect(exitCode).toBe(1);
        expect(stderr).toContain("non-interactive mode");
      } finally {
        await cleanup();
      }
    });

    it("shows docsDir from manifest", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stdout, exitCode } = await runCli(["config", "get", "docsDir"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe("aidd_docs");
      } finally {
        await cleanup();
      }
    });

    it("shows default repo when not explicitly set", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stdout, exitCode } = await runCli(["config", "get", "repo"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe("ai-driven-dev/aidd-framework");
      } finally {
        await cleanup();
      }
    });

    it("shows custom repo saved during init --repo", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH, { repo: "my-org/my-framework" });

        const { stdout, exitCode } = await runCli(["config", "get", "repo"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toBe("my-org/my-framework");
      } finally {
        await cleanup();
      }
    });

    it("shows installed tools list", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);
        await runCli(["install", "ai", "claude", "--path", FRAMEWORK_PATH], projectDir);

        const { stdout, exitCode } = await runCli(["config", "get", "tools"], projectDir);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toContain("claude");
      } finally {
        await cleanup();
      }
    });

    it("fails on unknown key", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(["config", "get", "unknown"], projectDir);
        expect(exitCode).toBe(1);
        expect(stderr).toContain("Unknown key");
      } finally {
        await cleanup();
      }
    });
  });

  describe("config set", () => {
    it("exits with error when no arguments are provided in non-interactive mode", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(["config", "set"], projectDir);
        expect(exitCode).toBe(1);
        expect(stderr).toContain("non-interactive mode");
      } finally {
        await cleanup();
      }
    });

    it("updates docsDir in manifest with --force", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { exitCode } = await runCli(
          ["config", "set", "docsDir", "my_docs", "--force"],
          projectDir
        );
        expect(exitCode).toBe(0);

        const { stdout } = await runCli(["config", "get", "docsDir"], projectDir);
        expect(stdout.trim()).toBe("my_docs");
      } finally {
        await cleanup();
      }
    });

    it("is a no-op when value is unchanged", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stdout, exitCode } = await runCli(
          ["config", "set", "docsDir", "aidd_docs", "--force"],
          projectDir
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("already");
      } finally {
        await cleanup();
      }
    });

    it("rejects write without --force in non-interactive mode", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(
          ["config", "set", "docsDir", "my_docs"],
          projectDir
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("Use --force");
      } finally {
        await cleanup();
      }
    });

    it("rejects write on read-only key", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(
          ["config", "set", "tools", "claude", "--force"],
          projectDir
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("read-only");
      } finally {
        await cleanup();
      }
    });

    it("rejects write on unknown key", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(
          ["config", "set", "verbose", "true", "--force"],
          projectDir
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("Unknown key");
      } finally {
        await cleanup();
      }
    });

    it("shows warning when new directory does not exist on disk", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr } = await runCli(
          ["config", "set", "docsDir", "my_docs", "--force"],
          projectDir
        );
        expect(stderr).toContain("does not exist on disk");
        expect(stderr).toContain("Move your docs manually");
      } finally {
        await cleanup();
      }
    });

    it("shows no warning when new directory already exists on disk", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);
        await mkdir(join(projectDir, "my_docs"), { recursive: true });

        const { stdout, stderr } = await runCli(
          ["config", "set", "docsDir", "my_docs", "--force"],
          projectDir
        );
        expect(stdout).toContain("found on disk");
        expect(stderr).not.toContain("does not exist");
        expect(stderr).not.toContain("Move your docs");
      } finally {
        await cleanup();
      }
    });

    it("updates repo in manifest with --force", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { exitCode } = await runCli(
          ["config", "set", "repo", "my-org/custom-framework", "--force"],
          projectDir
        );
        expect(exitCode).toBe(0);

        const { stdout } = await runCli(["config", "get", "repo"], projectDir);
        expect(stdout.trim()).toBe("my-org/custom-framework");
      } finally {
        await cleanup();
      }
    });

    it("rejects invalid repo format", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        await initProject(projectDir, FRAMEWORK_PATH);

        const { stderr, exitCode } = await runCli(
          ["config", "set", "repo", "not-valid", "--force"],
          projectDir
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("owner/repo");
      } finally {
        await cleanup();
      }
    });

    it("fails when no manifest exists", async () => {
      const { projectDir, cleanup } = await createTestEnv("config");
      try {
        const { stderr, exitCode } = await runCli(
          ["config", "set", "docsDir", "my_docs", "--force"],
          projectDir
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("No AIDD manifest found");
      } finally {
        await cleanup();
      }
    });
  });
});
