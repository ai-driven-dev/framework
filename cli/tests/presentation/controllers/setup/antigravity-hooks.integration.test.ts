import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
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

/** What the released CLI wrote for aidd-context: the group in the project's `.agents/hooks.json`
 * and the entry's digest it recorded, both as captured from that release. */
const RELEASED_COMMAND =
  "node -e \"const p=require('node:child_process').spawn(Buffer.from(process.argv[1],'base64').toString(),{shell:true,cwd:'..',stdio:['inherit','pipe','inherit']});let empty=true;p.stdout.on('data',d=>{empty=false;process.stdout.write(d)});p.on('close',c=>{if(empty)process.stdout.write('{}');process.exitCode=c??1});\" bm9kZSAuLy5hZ2VudHMvaG9va3MvYWlkZC1jb250ZXh0L21lbW9yeS5janMgbG9hZA==";
const RELEASED_DIGEST = "1daba6a99a2ff06947caaa0ee5d6c2e8";
const RELEASED_SCRIPT = `.agents/hooks/${PLUGIN}/memory.cjs`;
const RELEASED_GROUP = {
  [PLUGIN]: { SessionStart: [{ type: "command", command: RELEASED_COMMAND, timeout: 5 }] },
};

type Manifest = {
  tools: { antigravity: { plugins: { name: string; projectHooks?: unknown }[] } };
};

/** An install of the released CLI over the project: its hooks group, its script, and the
 * provenance it recorded for both. */
async function leaveReleasedHooks(): Promise<void> {
  await mkdir(join(project, ".agents", "hooks", PLUGIN), { recursive: true });
  await writeFile(join(project, RELEASED_SCRIPT), "released script\n");
  await writeFile(userHooksFile(), JSON.stringify({ ...RELEASED_GROUP, lint: LINT_HOOK }, null, 2));
  const path = join(project, ".aidd", "manifest.json");
  const manifest = await readJson<Manifest>(path);
  const plugin = manifest.tools.antigravity.plugins.find((p) => p.name === PLUGIN);
  if (plugin === undefined) throw new Error("plugin not installed");
  plugin.projectHooks = {
    entries: [{ event: "SessionStart", command: RELEASED_COMMAND, digest: RELEASED_DIGEST }],
    scripts: { [RELEASED_SCRIPT]: FileHash.of("released script\n").value },
  };
  await writeFile(path, JSON.stringify(manifest, null, 2));
}

async function installOverReleased(): Promise<void> {
  const setup = await aidd(setupFromFixture("antigravity", PLUGIN));
  expect(setup.exitCode, setup.stderr).toBe(0);
  await leaveReleasedHooks();
}

describe("antigravity hooks an earlier release merged into the project", () => {
  it("sync takes the plugin's group and script out of the project's hooks, and keeps the user's", async () => {
    await installOverReleased();

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readJson<Hooks>(userHooksFile())).toEqual({ lint: LINT_HOOK });
    expect(existsSync(join(project, RELEASED_SCRIPT))).toBe(false);
    const manifest = await readJson<Manifest>(join(project, ".aidd", "manifest.json"));
    expect(manifest.tools.antigravity.plugins[0]).not.toHaveProperty("projectHooks");
  });

  it("clean --force takes them out too", async () => {
    await installOverReleased();

    const clean = await aidd(["clean", "--force"]);

    expect(clean.exitCode, clean.stderr).toBe(0);
    expect(await readJson<Hooks>(userHooksFile())).toEqual({ lint: LINT_HOOK });
    expect(existsSync(join(project, RELEASED_SCRIPT))).toBe(false);
  });
});
