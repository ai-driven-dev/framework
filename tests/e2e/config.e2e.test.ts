import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FRAMEWORK_PATH, runCli } from "./helpers.js";

describe("E2E: aidd config", () => {
  let tempDir: string;
  let projectDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "aidd-e2e-config-"));
    projectDir = join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("config list", () => {
    it("fails when no manifest exists", async () => {
      const { stderr, exitCode } = await runCli(["config", "list"], projectDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("No AIDD installation found");
    });

    it("shows docsDir and tools from manifest", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["config", "list"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("docsDir = aidd_docs");
      expect(stdout).toContain("tools   = claude");
    }, 10000);

    it("shows (none) for tools when nothing installed", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["config", "list"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("tools   = (none)");
    }, 10000);
  });

  describe("config get", () => {
    it("returns docsDir from manifest", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["config", "get", "docsDir"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("aidd_docs");
    }, 10000);

    it("returns default repo when not explicitly set", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["config", "get", "repo"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("ai-driven-dev/aidd-framework");
    }, 10000);

    it("returns repo saved during init --repo", async () => {
      await runCli(
        ["init", "--framework", FRAMEWORK_PATH, "--repo", "my-org/my-framework"],
        projectDir
      );

      const { stdout, exitCode } = await runCli(["config", "get", "repo"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toBe("my-org/my-framework");
    }, 10000);

    it("returns installed tools list", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      await runCli(["install", "claude", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(["config", "get", "tools"], projectDir);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toContain("claude");
    }, 10000);

    it("fails on unknown key", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(["config", "get", "unknown"], projectDir);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown key");
    }, 10000);
  });

  describe("config set", () => {
    it("updates docsDir in manifest with --force", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { exitCode } = await runCli(
        ["config", "set", "docsDir", "my_docs", "--force"],
        projectDir
      );
      expect(exitCode).toBe(0);

      const { stdout } = await runCli(["config", "get", "docsDir"], projectDir);
      expect(stdout.trim()).toBe("my_docs");
    }, 10000);

    it("is a no-op when value is unchanged", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stdout, exitCode } = await runCli(
        ["config", "set", "docsDir", "aidd_docs", "--force"],
        projectDir
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("already");
    }, 10000);

    it("rejects write without --force in non-interactive mode", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["config", "set", "docsDir", "my_docs"],
        projectDir
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Use --force");
    }, 10000);

    it("rejects write on read-only key", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["config", "set", "tools", "claude", "--force"],
        projectDir
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("read-only");
    }, 10000);

    it("rejects write on unknown key", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["config", "set", "verbose", "true", "--force"],
        projectDir
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown key");
    }, 10000);

    it("shows warning when new directory does not exist on disk", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr } = await runCli(
        ["config", "set", "docsDir", "my_docs", "--force"],
        projectDir
      );
      expect(stderr).toContain("does not exist on disk");
      expect(stderr).toContain("Move your docs manually");
    }, 10000);

    it("shows no warning when new directory already exists on disk", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);
      const { mkdir } = await import("node:fs/promises");
      await mkdir(join(projectDir, "my_docs"), { recursive: true });

      const { stdout, stderr } = await runCli(
        ["config", "set", "docsDir", "my_docs", "--force"],
        projectDir
      );
      expect(stdout).toContain("found on disk");
      expect(stderr).not.toContain("does not exist");
      expect(stderr).not.toContain("Move your docs");
    }, 10000);

    it("updates repo in manifest with --force", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { exitCode } = await runCli(
        ["config", "set", "repo", "my-org/custom-framework", "--force"],
        projectDir
      );
      expect(exitCode).toBe(0);

      const { stdout } = await runCli(["config", "get", "repo"], projectDir);
      expect(stdout.trim()).toBe("my-org/custom-framework");
    }, 10000);

    it("rejects invalid repo format", async () => {
      await runCli(["init", "--framework", FRAMEWORK_PATH], projectDir);

      const { stderr, exitCode } = await runCli(
        ["config", "set", "repo", "not-valid", "--force"],
        projectDir
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("owner/repo");
    }, 10000);

    it("fails when no manifest exists", async () => {
      const { stderr, exitCode } = await runCli(
        ["config", "set", "docsDir", "my_docs", "--force"],
        projectDir
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("No AIDD installation found");
    });
  });
});
