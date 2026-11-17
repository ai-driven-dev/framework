import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../src/kernel/markdown.js";
import { REPOSITORY_ROOT } from "../helpers/repository-root.js";
import { createTestEnv, runCli } from "./helpers.js";

const AGENT = ".opencode/agents/aidd-orchestrator-reviewer.md";

async function fileExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

const SETUP = ["setup", "--source", "local", "--path", REPOSITORY_ROOT, "--ide", "opencode"];

async function agentModel(projectDir: string): Promise<unknown> {
  return parseFrontmatter(await readFile(join(projectDir, AGENT), "utf8")).frontmatter.model;
}

/** The main session's model, in OpenCode's user config: never a file the project tracks. */
async function mainModel(home: string): Promise<unknown> {
  const path = join(home, ".config", "opencode", "opencode.jsonc");
  if (!(await fileExists(path))) return undefined;
  return (JSON.parse(await readFile(path, "utf8")) as { model?: unknown }).model;
}

describe("E2E: aidd setup --provider on a project", () => {
  it("installs the agents with the provider's models, and undoes it", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models");
    try {
      const install = ["--plugins", "aidd-orchestrator", "--yes"];
      const setup = await runCli([...SETUP, ...install], projectDir, fakeHome);
      expect(setup.exitCode, setup.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBeUndefined();

      const set = await runCli(
        [...SETUP, ...install, "--provider", "mistral"],
        projectDir,
        fakeHome
      );
      expect(set.exitCode, set.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBe("mistral/mistral-small-latest#high");
      expect(await mainModel(fakeHome)).toBe("mistral/mistral-large-4");
      expect(await readFile(join(projectDir, "opencode.json"), "utf8")).not.toContain('"model"');
      expect(set.stdout).toContain(
        "opencode explorer, executor, validator, reviewer: mistral/mistral-small-latest (high)"
      );

      const unset = await runCli(
        [...SETUP, ...install, "--provider", "none"],
        projectDir,
        fakeHome
      );
      expect(unset.exitCode, unset.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBeUndefined();
      expect(await mainModel(fakeHome)).toBeUndefined();
    } finally {
      await cleanup();
    }
  });

  it("gives everything back with clean --global: main session, provider and machine-wide agents", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-clean");
    try {
      const global = [
        "setup",
        "--global",
        "--source",
        "local",
        "--path",
        REPOSITORY_ROOT,
        "--ide",
        "opencode",
        "--plugins",
        "aidd-orchestrator",
        "--yes",
      ];
      const set = await runCli([...global, "--provider", "mistral"], projectDir, fakeHome);
      expect(set.exitCode, set.stderr).toBe(0);
      expect(await mainModel(fakeHome)).toBe("mistral/mistral-large-4");

      const clean = await runCli(["clean", "--global", "--force"], projectDir, fakeHome);
      expect(clean.exitCode, clean.stderr).toBe(0);
      expect(clean.stdout).toContain("opencode main session: restored in");
      expect(await fileExists(join(fakeHome, ".config", "opencode", "opencode.jsonc"))).toBe(false);
      expect(await fileExists(join(fakeHome, ".config", "opencode", "agents"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("reruns global agent models without changing main-session settings", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-global-only");
    try {
      const global = [
        "setup",
        "--global",
        "--source",
        "local",
        "--path",
        REPOSITORY_ROOT,
        "--ide",
        "opencode",
        "--plugins",
        "aidd-orchestrator",
        "--yes",
      ];
      const initial = await runCli([...global, "--provider", "mistral"], projectDir, fakeHome);
      expect(initial.exitCode, initial.stderr).toBe(0);

      const settingsPath = join(fakeHome, ".config", "opencode", "opencode.jsonc");
      await writeFile(settingsPath, '{\n  "model": "personal/model"\n}\n');
      const rerun = await runCli(
        [...global, "--provider", "openai", "--agents-only"],
        projectDir,
        fakeHome
      );

      expect(rerun.exitCode, rerun.stderr).toBe(0);
      expect(rerun.stdout).toContain("main session unchanged");
      expect(await readFile(settingsPath, "utf8")).toBe('{\n  "model": "personal/model"\n}\n');
      const userAgent = join(
        fakeHome,
        ".config",
        "opencode",
        "agents",
        "aidd-orchestrator-reviewer.md"
      );
      expect(parseFrontmatter(await readFile(userAgent, "utf8")).frontmatter.model).toEqual(
        expect.stringContaining("openai/")
      );
    } finally {
      await cleanup();
    }
  });

  it("refuses a provider the IDE cannot run, and changes nothing", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-refused");
    try {
      const result = await runCli(
        ["setup", "--ide", "claude", "--plugins", "none", "--provider", "mistral"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Provider "mistral" is not supported for "claude"');
      expect(await fileExists(join(projectDir, ".claude"))).toBe(false);
    } finally {
      await cleanup();
    }
  });
});
