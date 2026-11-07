import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestEnv } from "../../e2e/helpers.js";
import { setupFromFixture } from "../../helpers/fixture-setup.js";
import { runInProcess } from "../../helpers/in-process-cli.js";
import { readJson } from "../../helpers/project-state.js";

const PLUGIN = "aidd-context";
const SCRIPT = `.agents/hooks/${PLUGIN}/update_memory.js`;
const OWN_SKILL = `.agents/skills/${PLUGIN}-05-learn/SKILL.md`;
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
const hooksFile = () => join(project, ".agents", "hooks.json");
const readHooks = () => readJson<Hooks>(hooksFile());

/** Installs the plugin for antigravity, then adds a hook of the person's own beside it. */
async function installWithUserLintHook(): Promise<Hooks> {
  const setup = await aidd(setupFromFixture("antigravity", PLUGIN));
  expect(setup.exitCode, setup.stderr).toBe(0);
  const hooks = await readHooks();
  await writeFile(hooksFile(), JSON.stringify({ ...hooks, lint: LINT_HOOK }, null, 2));
  return hooks;
}

async function editScript(): Promise<string> {
  const path = join(project, SCRIPT);
  const installed = await readFile(path, "utf-8");
  await writeFile(path, `${installed}// mine\n`);
  return installed;
}

async function editEntry(): Promise<void> {
  const hooks = (await readHooks()) as Record<string, { SessionStart: { command: string }[] }>;
  for (const entry of hooks[PLUGIN]?.SessionStart ?? []) entry.command += " --verbose";
  await writeFile(hooksFile(), JSON.stringify(hooks, null, 2));
}

describe("antigravity hooks the user edited after setup", () => {
  it("keeps a disabled AIDD hook disabled through sync and removes it on clean", async () => {
    const hooks = await installWithUserLintHook();
    const disabled = {
      ...hooks,
      [PLUGIN]: { ...(hooks[PLUGIN] as object), enabled: false },
      lint: LINT_HOOK,
    };
    await writeFile(hooksFile(), JSON.stringify(disabled));

    for (const args of [["sync"], ["sync", "--force"]]) {
      const sync = await aidd(args);
      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(await readHooks()).toEqual(disabled);
    }

    const clean = await aidd(["clean", "--force"]);
    expect(clean.exitCode, clean.stderr).toBe(0);
    expect(await readHooks()).toEqual({ lint: LINT_HOOK });
    expect(existsSync(join(project, SCRIPT))).toBe(false);
  });

  it("records a project-delivered hook script once, under the hooks provenance only", async () => {
    await installWithUserLintHook();

    const manifest = await readJson<{
      tools: {
        antigravity: {
          plugins: {
            name: string;
            files: Record<string, unknown>;
            projectHooks: { scripts: Record<string, unknown> };
          }[];
        };
      };
    }>(join(project, ".aidd", "manifest.json"));
    const plugin = manifest.tools.antigravity.plugins.find((p) => p.name === PLUGIN);

    expect(
      Object.keys(plugin?.files ?? {}).filter((path) => path.startsWith(".agents/hooks/"))
    ).toEqual([]);
    expect(Object.keys(plugin?.projectHooks.scripts ?? {})).toEqual([SCRIPT]);
  });

  it("sync --force rewrites an edited hook script, restores a drifted skill and keeps the user hook", async () => {
    const hooks = await installWithUserLintHook();
    const installed = await editScript();
    const skill = join(project, OWN_SKILL);
    const skillInstalled = await readFile(skill, "utf-8");
    await writeFile(skill, `${skillInstalled}drift\n`);

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readFile(join(project, SCRIPT), "utf-8")).toBe(installed);
    expect(await readFile(skill, "utf-8")).toBe(skillInstalled);
    expect(await readHooks()).toEqual({ ...hooks, lint: LINT_HOOK });
  });

  it("sync --force rewrites an edited hooks.json entry and keeps the user hook", async () => {
    const hooks = await installWithUserLintHook();
    await editEntry();

    const sync = await aidd(["sync", "--force"]);

    expect(sync.exitCode, sync.stderr).toBe(0);
    expect(await readHooks()).toEqual({ ...hooks, lint: LINT_HOOK });
  });

  it("clean --force removes an edited hook and every plugin file, and keeps the user hook", async () => {
    await installWithUserLintHook();
    await editScript();
    await editEntry();

    const clean = await aidd(["clean", "--force"]);

    expect(clean.exitCode, clean.stderr).toBe(0);
    expect(existsSync(join(project, SCRIPT))).toBe(false);
    expect(existsSync(join(project, OWN_SKILL))).toBe(false);
    expect(await readHooks()).toEqual({ lint: LINT_HOOK });
  });

  it("sync without --force refuses an edited hook script and names --force", async () => {
    await installWithUserLintHook();
    await editScript();

    const sync = await aidd(["sync"]);

    expect(sync.exitCode).toBe(1);
    expect(`${sync.stdout}${sync.stderr}`).toMatch(/edited after install.*--force/);
  });
});
