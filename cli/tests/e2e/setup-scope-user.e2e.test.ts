import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { environmentWithoutGitVariables } from "../../src/contexts/telemetry/infrastructure/git/git-environment.js";
import { gitStatusPorcelain } from "../helpers/project-state.js";
import { createTestEnv, gitInit, runCli } from "./helpers.js";

// CI runners carry no git identity; a commit made by a test brings its own.
const GIT_TEST_IDENTITY = ["-c", "user.email=t@t.com", "-c", "user.name=t"];

const execFileAsync = promisify(execFile);
const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");

describe("E2E: setup --scope user writes nothing under the project", () => {
  it("installs OpenCode's skills and agents for the machine, refreshes them, and cleans them", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("scope-user-opencode");
    try {
      await gitInit(projectDir);
      await execFileAsync("git", [...GIT_TEST_IDENTITY, "commit", "--allow-empty", "-m", "empty"], {
        cwd: projectDir,
        env: environmentWithoutGitVariables(process.env),
      });
      const opencode = join(fakeHome, ".config", "opencode");

      const setup = await runCli(
        [
          "setup",
          "--global",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ide",
          "opencode",
          "--plugins",
          "aidd-dev",
          "--yes",
        ],
        projectDir,
        fakeHome
      );
      expect(setup.stderr).toBe("");
      expect(setup.exitCode).toBe(0);
      expect(setup.stdout).toContain("Installed for every project on this machine: aidd-dev.");
      expect(await gitStatusPorcelain(projectDir)).toBe("");
      const agent = join(opencode, "agents", "aidd-dev-reviewer.md");
      expect(await readFile(agent, "utf-8")).toMatch(/^mode: '?subagent'?$/m);
      const skills = await readdir(join(opencode, "skills", "aidd-dev"));
      expect(skills.length).toBeGreaterThan(0);

      const sync = await runCli(["sync", "--global"], projectDir, fakeHome);
      expect(sync.exitCode).toBe(0);
      expect(sync.stdout).toContain("Refreshed global files for: aidd-dev");

      const clean = await runCli(["clean", "--global", "--force"], projectDir, fakeHome);
      expect(clean.exitCode).toBe(0);
      await expect(readFile(agent, "utf-8")).rejects.toThrow();
      expect(await gitStatusPorcelain(projectDir)).toBe("");
    } finally {
      await cleanup();
    }
  });

  it("preserves a pre-existing identical agent through refused setup and global clean", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("scope-user-unowned-agent");
    try {
      const args = [
        "setup",
        "--global",
        "--source",
        "local",
        "--path",
        FRAMEWORK_REAL_PATH,
        "--ide",
        "opencode",
        "--plugins",
        "aidd-dev",
        "--yes",
      ];
      expect((await runCli(args, projectDir, fakeHome)).exitCode).toBe(0);
      const agent = join(fakeHome, ".config", "opencode", "agents", "aidd-dev-reviewer.md");
      const content = await readFile(agent, "utf-8");
      expect((await runCli(["clean", "--global", "--force"], projectDir, fakeHome)).exitCode).toBe(
        0
      );
      await mkdir(dirname(agent), { recursive: true });
      await writeFile(agent, content);

      const refused = await runCli(args, projectDir, fakeHome);
      expect(refused.exitCode).toBe(1);
      expect(refused.stderr).toContain("already exists and was not installed by aidd");
      expect((await runCli(["clean", "--global", "--force"], projectDir, fakeHome)).exitCode).toBe(
        0
      );
      expect(await readFile(agent, "utf-8")).toBe(content);
    } finally {
      await cleanup();
    }
  });

  it("honors --tool and refuses --plugin at --scope user for doctor and sync, rather than silently ignoring either", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("scope-user-flags");
    try {
      await gitInit(projectDir);
      await execFileAsync("git", [...GIT_TEST_IDENTITY, "commit", "--allow-empty", "-m", "empty"], {
        cwd: projectDir,
        env: environmentWithoutGitVariables(process.env),
      });

      const setupResult = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          FRAMEWORK_REAL_PATH,
          "--ai",
          "claude,codex",
          "--plugins",
          "none",
          "--yes",
          "--scope",
          "user",
        ],
        projectDir,
        fakeHome
      );
      expect(setupResult.exitCode).toBe(0);

      // --tool narrows doctor's own user-scope tool inventory to the one tool named,
      // rather than being read and discarded.
      const doctorScoped = await runCli(
        ["doctor", "--scope", "user", "--tool", "claude"],
        projectDir,
        fakeHome
      );
      expect(doctorScoped.exitCode).toBe(0);
      expect(doctorScoped.stdout).toContain("claude");
      expect(doctorScoped.stdout).not.toContain("codex");

      // --plugin has nothing to narrow at user scope — no plugin is tracked there yet —
      // so it is refused with a real message rather than silently dropped.
      const doctorPlugin = await runCli(
        ["doctor", "--scope", "user", "--plugin", "aidd-context"],
        projectDir,
        fakeHome
      );
      expect(doctorPlugin.exitCode).toBe(1);
      expect(doctorPlugin.stderr).toContain("--plugin");

      const syncPlugin = await runCli(
        ["sync", "--scope", "user", "--plugin", "aidd-context"],
        projectDir,
        fakeHome
      );
      expect(syncPlugin.exitCode).toBe(1);
      expect(syncPlugin.stderr).toContain("--plugin");

      // A file argument has nothing to narrow either — sync's own project-scope file
      // list has no user-scope counterpart.
      const syncFiles = await runCli(
        ["sync", "--scope", "user", "some-file.md"],
        projectDir,
        fakeHome
      );
      expect(syncFiles.exitCode).toBe(1);
    } finally {
      await cleanup();
    }
  });
});
