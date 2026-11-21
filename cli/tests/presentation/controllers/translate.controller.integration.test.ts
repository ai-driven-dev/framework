import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv, FRAMEWORK_PATH } from "../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../shared/testing/in-process-cli.builder.js";

let root: string;
let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const env = await createTestEnv("translate-in-process");
  ({ projectDir: project, fakeHome: home, cleanup } = env);
  root = env.tempDir;
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });

const COPILOT_AGENT_KEYS = new Set([
  "name",
  "description",
  "model",
  "reasoningEffort",
  "include-custom-instructions",
]);

describe("aidd translate through the real build", () => {
  it("halts on a plugin manifest without a name and writes a message on stderr", async () => {
    const source = join(root, "source");
    await cp(FRAMEWORK_PATH, source, { recursive: true });
    const manifestDir = join(source, "plugins", "aidd-test", ".claude-plugin");
    await mkdir(manifestDir, { recursive: true });
    await writeFile(
      join(manifestDir, "plugin.json"),
      JSON.stringify({ version: "1.0.0" }),
      "utf-8"
    );

    const run = await aidd(["translate", source, "--to", "copilot", "--out", join(root, "dist")]);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toBeTruthy();
  });

  it("writes a flat copilot tree under the canonical paths, with only the frontmatter copilot allows", async () => {
    const out = join(root, "proj");
    await mkdir(out, { recursive: true });

    const run = await aidd([
      "translate",
      FRAMEWORK_PATH,
      "--to",
      "copilot",
      "--as",
      "flat",
      "--out",
      out,
    ]);

    expect(run.exitCode, run.stderr).toBe(0);
    expect(run.stdout).toContain("Flat-installed");
    const agent = join(out, ".github", "agents", "aidd-test-code-reviewer.agent.md");
    expect(existsSync(agent)).toBe(true);
    expect(existsSync(join(out, ".github", "skills", "aidd-test-commit", "SKILL.md"))).toBe(true);
    expect(existsSync(join(out, ".github", "hooks", "aidd-test.hooks.json"))).toBe(true);
    expect(existsSync(join(out, ".vscode", "mcp.json"))).toBe(true);
    expect(existsSync(join(out, ".github", "plugin", "marketplace.json"))).toBe(false);
    const frontmatter = (await readFile(agent, "utf-8")).match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatter).not.toBeNull();
    const keys = (frontmatter?.[1] ?? "")
      .split("\n")
      .map((line) => line.split(":")[0]?.trim() ?? "")
      .filter(Boolean);
    expect(keys.filter((key) => !COPILOT_AGENT_KEYS.has(key))).toEqual([]);
  });

  it("refuses a marketplace layout for a target that only builds flat", async () => {
    const run = await aidd([
      "translate",
      FRAMEWORK_PATH,
      "--to",
      "opencode",
      "--out",
      join(root, "dist"),
    ]);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toMatch(/Unsupported target.mode/i);
  });

  it("refuses a non-empty --out without --force and leaves the foreign file untouched", async () => {
    const out = join(root, "dist");
    await mkdir(out, { recursive: true });
    const keep = join(out, "keep.txt");
    await writeFile(keep, "keepme", "utf-8");

    const run = await aidd(["translate", FRAMEWORK_PATH, "--to", "copilot", "--out", out]);

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr).toContain(out);
    expect(run.stderr).toContain("--force");
    expect(await readFile(keep, "utf-8")).toBe("keepme");
  });
});
