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

const SETUP = ["setup", "--source", "local", "--path", REPOSITORY_ROOT, "--ide", "opencode"];

async function agentModel(projectDir: string): Promise<unknown> {
  return parseFrontmatter(await readFile(join(projectDir, AGENT), "utf8")).frontmatter.model;
}

describe("E2E: aidd setup --provider on a project", () => {
  it("installs the agents with the provider's models, sets the main session, and undoes both", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models");
    try {
      const install = ["--plugins", "aidd-orchestrator", "--yes"];
      const setup = await runCli([...SETUP, ...install], projectDir, fakeHome);
      expect(setup.exitCode, setup.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBeUndefined();

      const set = await runCli(
        [...SETUP, ...install, "--provider", "mistral", "--main"],
        projectDir,
        fakeHome
      );
      expect(set.exitCode, set.stderr).toBe(0);
      expect(await agentModel(projectDir)).toBe("mistral/mistral-medium-latest#high");
      expect(JSON.parse(await readFile(join(projectDir, "opencode.json"), "utf8")).model).toBe(
        "mistral/mistral-large-4"
      );

      const unset = await runCli(
        [...SETUP, ...install, "--provider", "none"],
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

  it("refuses a provider the IDE cannot run, and changes nothing", async () => {
    const { projectDir, fakeHome, cleanup } = await createTestEnv("agent-models-refused");
    try {
      const result = await runCli(
        ["setup", "--ide", "claude", "--plugins", "none", "--provider", "mistral", "--main"],
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
