import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../../shared/testing/cli-sandbox.builder.js";
import { runInProcess } from "../../../shared/testing/in-process-cli.builder.js";
import { setupFromFixture } from "../../testing/fixture-setup.builder.js";
import { readJson } from "../../testing/project-state.builder.js";

const PLUGIN = "aidd-context";
const PLUGIN_DIR = `.agents/plugins/${PLUGIN}`;
const SCRIPT = `${PLUGIN_DIR}/hooks/update_memory.js`;
const PLUGIN_HOOKS = `${PLUGIN_DIR}/hooks.json`;
const OWN_SKILL = `${PLUGIN_DIR}/skills/05-learn/SKILL.md`;
const FOREIGN_SKILL = "# mine\n";
const LINT_HOOK = { SessionStart: [{ type: "command", command: "echo lint" }] };

type Hooks = Record<string, unknown>;

let project: string;
let home: string;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  ({ projectDir: project, fakeHome: home, cleanup } = await createTestEnv("antigravity-hooks"));
});

afterEach(async () => {
  await cleanup();
});

const aidd = (args: string[]) => runInProcess(args, { cwd: project, home });
const pluginHooksFile = () => join(project, PLUGIN_HOOKS);
const userHooksFile = () => join(project, ".agents", "hooks.json");
const readPluginHooks = () => readJson<Hooks>(pluginHooksFile());

/** Installs the plugin for antigravity, then adds a project hook of the person's own beside it. */
async function installWithUserLintHook(): Promise<Hooks> {
  const setup = await aidd(setupFromFixture("antigravity", PLUGIN));
  expect(setup.exitCode, setup.stderr).toBe(0);
  await writeFile(userHooksFile(), JSON.stringify({ lint: LINT_HOOK }, null, 2));
  return readPluginHooks();
}

/** A skill of the person's own, beside the plugin's. */
async function writeForeignSkill(): Promise<string> {
  const path = join(project, ".agents", "skills", "mine", "SKILL.md");
  await mkdir(join(project, ".agents", "skills", "mine"), { recursive: true });
  await writeFile(path, FOREIGN_SKILL);
  return path;
}

async function editScript(): Promise<string> {
  const path = join(project, SCRIPT);
  const installed = await readFile(path, "utf-8");
  await writeFile(path, `${installed}// mine\n`);
  return installed;
}

async function editEntry(): Promise<void> {
  const hooks = (await readPluginHooks()) as Record<
    string,
    { SessionStart: { command: string }[] }
  >;
  for (const entry of hooks[PLUGIN]?.SessionStart ?? []) entry.command += " --verbose";
  await writeFile(pluginHooksFile(), JSON.stringify(hooks, null, 2));
}

describe("antigravity hooks the user edited after setup", () => {
  it("delivers the plugin's hooks as the file of its own directory, and none to the project's", async () => {
    const hooks = await installWithUserLintHook();

    expect(Object.keys(hooks)).toEqual([PLUGIN]);
    expect(await readJson<Hooks>(userHooksFile())).toEqual({ lint: LINT_HOOK });
  });

  it("records a hook script once, among the plugin's files, and no project hooks", async () => {
    await installWithUserLintHook();

    const manifest = await readJson<{
      tools: {
        antigravity: { plugins: { name: string; files: Record<string, unknown> }[] };
      };
    }>(join(project, ".aidd", "manifest.json"));
    const plugin = manifest.tools.antigravity.plugins.find((p) => p.name === PLUGIN);

    expect(Object.keys(plugin?.files ?? {})).toEqual(
      expect.arrayContaining([SCRIPT, PLUGIN_HOOKS, OWN_SKILL])
    );
    expect(plugin).not.toHaveProperty("projectHooks");
  });

  it("sync --force rewrites an edited hook script and hooks file, restores a drifted skill and keeps the user hook and skill", async () => {
    const hooks = await installWithUserLintHook();
    const foreign = await writeForeignSkill();
    const installed = await editScript();
    await editEntry();
    const skill = join(project, OWN_SKILL);
    const skillInstalled = await readFile(skill, "utf-8");
    await writeFile(skill, `${skillInstalled}drift\n`);

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readFile(join(project, SCRIPT), "utf-8")).toBe(installed);
    expect(await readFile(skill, "utf-8")).toBe(skillInstalled);
    expect(await readFile(foreign, "utf-8")).toBe(FOREIGN_SKILL);
    expect(await readPluginHooks()).toEqual(hooks);
    expect(await readJson<Hooks>(userHooksFile())).toEqual({ lint: LINT_HOOK });
  });

  it("clean --force removes an edited hook and every plugin file, and keeps the user hook and skill", async () => {
    await installWithUserLintHook();
    const foreign = await writeForeignSkill();
    await editScript();
    await editEntry();

    const clean = await aidd(["clean", "--force"]);

    expect(clean.exitCode, clean.stderr).toBe(0);
    expect(existsSync(join(project, SCRIPT))).toBe(false);
    expect(existsSync(pluginHooksFile())).toBe(false);
    expect(existsSync(join(project, OWN_SKILL))).toBe(false);
    expect(await readFile(foreign, "utf-8")).toBe(FOREIGN_SKILL);
    expect(await readJson<Hooks>(userHooksFile())).toEqual({ lint: LINT_HOOK });
  });
});
