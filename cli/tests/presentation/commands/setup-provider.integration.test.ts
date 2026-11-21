import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "../../../src/shared/domain/markdown.js";
import { createTestEnv } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";
import { REPOSITORY_ROOT } from "../../shared/testing/repository-root.builder.js";
import { readJson } from "../testing/project-state.builder.js";

const AGENT = ".opencode/agents/aidd-orchestrator-reviewer.md";

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("setup-provider"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

async function fileExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

const SETUP = ["setup", "--source", "local", "--path", REPOSITORY_ROOT, "--ide", "opencode"];
const INSTALL = ["--plugins", "aidd-orchestrator", "--yes"];

async function agentModel(): Promise<unknown> {
  return parseFrontmatter(await readFile(join(project, AGENT), "utf8")).frontmatter.model;
}

/** The main session's model, in OpenCode's user config: never a file the project tracks. */
async function mainModel(): Promise<unknown> {
  const path = join(home, ".config", "opencode", "opencode.jsonc");
  if (!(await fileExists(path))) return undefined;
  const config = await readJson<{ model?: unknown }>(path);
  return config.model;
}

describe("aidd setup --provider on a project", () => {
  it("installs the agents with the provider's models, and undoes it", async () => {
    const setup = await aidd([...SETUP, ...INSTALL]);
    expect(setup.exitCode, setup.stderr).toBe(0);
    expect(await agentModel()).toBeUndefined();

    const set = await aidd([...SETUP, ...INSTALL, "--provider", "mistral"]);
    expect(set.exitCode, set.stderr).toBe(0);
    expect(await agentModel()).toBe("mistral/mistral-large-4#high");
    expect(await mainModel()).toBe("mistral/mistral-large-4");
    expect(await readFile(join(project, "opencode.json"), "utf8")).not.toContain('"model"');
    expect(set.stdout).toContain("opencode reviewer: mistral/mistral-large-4 (high)");

    const unset = await aidd([...SETUP, ...INSTALL, "--provider", "none"]);
    expect(unset.exitCode, unset.stderr).toBe(0);
    expect(await agentModel()).toBeUndefined();
    expect(await mainModel()).toBeUndefined();
  });

  it("gives everything back with clean --global: main session, provider and machine-wide agents", async () => {
    const global = ["setup", "--global", "--source", "local", "--path", REPOSITORY_ROOT];
    const set = await aidd([...global, "--ide", "opencode", ...INSTALL, "--provider", "mistral"]);
    expect(set.exitCode, set.stderr).toBe(0);
    expect(await mainModel()).toBe("mistral/mistral-large-4");

    const clean = await aidd(["clean", "--global", "--force"]);
    expect(clean.exitCode, clean.stderr).toBe(0);
    expect(clean.stdout).toContain("opencode main session: restored in");
    expect(await fileExists(join(home, ".config", "opencode", "opencode.jsonc"))).toBe(false);
    expect(await fileExists(join(home, ".config", "opencode", "agents"))).toBe(false);
  });

  it("refuses a provider the IDE cannot run, and changes nothing", async () => {
    const result = await aidd([
      "setup",
      "--ide",
      "claude",
      "--plugins",
      "none",
      "--provider",
      "mistral",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Provider "mistral" is not supported for "claude"');
    expect(await fileExists(join(project, ".claude"))).toBe(false);
  });
});
