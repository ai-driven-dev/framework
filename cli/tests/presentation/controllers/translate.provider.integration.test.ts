import { cp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

let root: string;
let project: string;
let home: string;
let source: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const env = await createTestEnv("translate-provider");
  ({ projectDir: project, fakeHome: home, cleanup } = env);
  root = env.tempDir;
  source = join(root, "source");
  await cp(FRAMEWORK_PATH, source, { recursive: true });
  const agents = join(source, "plugins", "aidd-test", "agents");
  await writeFile(
    join(agents, "explorer.md"),
    "---\nname: explorer\ndescription: Explores the code.\n---\n\nExplore.\n",
    "utf-8"
  );
  await writeFile(
    join(agents, "reviewer.md"),
    "---\nname: reviewer\ndescription: Reviews the code.\n---\n\nReview.\n",
    "utf-8"
  );
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

async function build(target: string, out: string, extra: string[] = []) {
  const run = await aidd(["translate", source, "--to", target, "--out", join(root, out), ...extra]);
  expect(run.exitCode, run.stderr).toBe(0);
  return join(root, out);
}

describe("aidd translate --provider on a Claude marketplace", () => {
  it("leaves each agent on the host's model without --provider", async () => {
    const out = await build("claude", "claude-plain");

    const explorer = await readFile(
      join(out, "plugins", "aidd-test", "agents", "explorer.md"),
      "utf-8"
    );
    expect(explorer).not.toMatch(/^model:/m);
    expect(explorer).not.toMatch(/^effort:/m);
  });

  it("writes each role's model and effort in the agent's frontmatter", async () => {
    const out = await build("claude", "claude-anthropic", ["--provider", "anthropic"]);

    const agents = join(out, "plugins", "aidd-test", "agents");
    const explorer = await readFile(join(agents, "explorer.md"), "utf-8");
    const reviewer = await readFile(join(agents, "reviewer.md"), "utf-8");
    expect(explorer).toMatch(/^model: 'claude-haiku-5-5'$/m);
    expect(explorer).toMatch(/^effort: 'medium'$/m);
    expect(reviewer).toMatch(/^model: 'claude-opus-5-5'$/m);
    expect(reviewer).toMatch(/^effort: 'high'$/m);
  });
});

describe("aidd translate --provider on a Codex marketplace", () => {
  it("leaves each agent on the host's model without --provider", async () => {
    const out = await build("codex", "codex-plain");

    const explorer = await readFile(
      join(out, "plugins", "aidd-test", "codex-agents", "explorer.toml"),
      "utf-8"
    );
    expect(explorer).not.toMatch(/^model\b/m);
    expect(explorer).not.toMatch(/^model_reasoning_effort\b/m);
  });

  it("writes each role's model and effort as TOML keys", async () => {
    const out = await build("codex", "codex-openai", ["--provider", "openai"]);

    const agents = join(out, "plugins", "aidd-test", "codex-agents");
    const explorer = await readFile(join(agents, "explorer.toml"), "utf-8");
    const reviewer = await readFile(join(agents, "reviewer.toml"), "utf-8");
    expect(explorer).toMatch(/^model = "gpt-6-luna"$/m);
    expect(explorer).toMatch(/^model_reasoning_effort = "medium"$/m);
    expect(reviewer).toMatch(/^model = "gpt-6.1-sol"$/m);
    expect(reviewer).toMatch(/^model_reasoning_effort = "high"$/m);
  });
});

describe("aidd translate --provider refusals", () => {
  it("refuses a provider no tool knows, before building", async () => {
    const run = await aidd([
      "translate",
      source,
      "--to",
      "claude",
      "--out",
      join(root, "x"),
      "--provider",
      "nope",
    ]);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('Unknown provider "nope"');
  });

  it("refuses a provider the target does not run", async () => {
    const run = await aidd([
      "translate",
      source,
      "--to",
      "codex",
      "--out",
      join(root, "x"),
      "--provider",
      "anthropic",
    ]);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain('Provider "anthropic" is not supported for "codex"');
  });
});
