import { access, readFile } from "node:fs/promises";
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

async function agentModel(projectDir: string): Promise<unknown> {
  return parseFrontmatter(await readFile(join(projectDir, AGENT), "utf8")).frontmatter.model;
}

describe("E2E: aidd agents set-model on an installed project", () => {
  it("re-installs the agents with the provider's models, sets the main session, and undoes both", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models");
    try {
      const setup = await runCli(
        [
          "setup",
          "--source",
          "local",
          "--path",
          REPOSITORY_ROOT,
          "--ide",
          "opencode",
          "--plugins",
          "aidd-orchestrator",
          "--yes",
        ],
        projectDir,
        fakeHome
      );
      expect(setup.exitCode, setup.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBeUndefined();

      const set = await runCli(
        ["agents", "set-model", "mistral", "--ide", "opencode", "--main"],
        projectDir,
        fakeHome
      );
      expect(set.exitCode, set.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBe("mistral/mistral-medium-latest#high");
      expect(JSON.parse(await readFile(join(projectDir, "opencode.json"), "utf8")).model).toBe(
        "mistral/mistral-large-4"
      );

      const unset = await runCli(
        ["agents", "unset-model", "--ide", "opencode"],
        projectDir,
        fakeHome
      );
      expect(unset.exitCode, unset.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBeUndefined();
      expect(
        JSON.parse(await readFile(join(projectDir, "opencode.json"), "utf8"))
      ).not.toHaveProperty("model");
      expect(await fileExists(join(projectDir, ".aidd/main-model.json"))).toBe(false);
    } finally {
      await cleanup();
    }
  });

  it("names an IDE whose main model has no setting at that scope, and leaves it alone", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-no-main");
    try {
      const result = await runCli(
        ["agents", "set-model", "mistral", "--ide", "opencode", "--global", "--main"],
        projectDir,
        fakeHome
      );
      expect(result.exitCode, result.stderr).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain(
        "No main-model setting at this scope for opencode; left unchanged."
      );
    } finally {
      await cleanup();
    }
  });

  it("refuses a provider the IDE cannot run, and changes nothing", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-refused");
    try {
      const result = await runCli(
        ["agents", "set-model", "mistral", "--ide", "claude", "--main"],
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
