import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestEnv, runCli } from "./helpers.js";

const FRAMEWORK_REAL_PATH = resolve(process.cwd(), "tests/fixtures/framework-real");
const PLUGIN = "aidd-context";
const SCRIPT = `.agents/hooks/${PLUGIN}/update_memory.js`;
const OWN_SKILL = `.agents/skills/${PLUGIN}-05-learn/SKILL.md`;
const LINT_HOOK = { SessionStart: [{ type: "command", command: "echo lint" }] };

type Env = Awaited<ReturnType<typeof createTestEnv>>;

async function installWithUserLintHook(test: Env): Promise<Record<string, unknown>> {
  const setup = await runCli(
    [
      "setup",
      "--source",
      "local",
      "--path",
      FRAMEWORK_REAL_PATH,
      "--ai",
      "antigravity",
      "--plugins",
      PLUGIN,
      "--yes",
    ],
    test.projectDir,
    test.fakeHome
  );
  expect(setup.exitCode, setup.stderr).toBe(0);
  const hooksFile = join(test.projectDir, ".agents", "hooks.json");
  const hooks = JSON.parse(await readFile(hooksFile, "utf-8"));
  await writeFile(hooksFile, JSON.stringify({ ...hooks, lint: LINT_HOOK }, null, 2));
  return hooks;
}

async function readHooks(test: Env): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(test.projectDir, ".agents", "hooks.json"), "utf-8"));
}

async function editScript(test: Env): Promise<string> {
  const path = join(test.projectDir, SCRIPT);
  const installed = await readFile(path, "utf-8");
  await writeFile(path, `${installed}// mine\n`);
  return installed;
}

async function editEntry(test: Env): Promise<void> {
  const hooks = (await readHooks(test)) as Record<string, { SessionStart: { command: string }[] }>;
  for (const entry of hooks[PLUGIN]?.SessionStart ?? []) entry.command += " --verbose";
  await writeFile(join(test.projectDir, ".agents", "hooks.json"), JSON.stringify(hooks, null, 2));
}

describe("E2E: antigravity hooks the user edited after setup", () => {
  it("records a project-delivered hook script once, under the hooks provenance only", async () => {
    const test = await createTestEnv("antigravity-hook-owner");
    try {
      await installWithUserLintHook(test);
      const manifest = JSON.parse(
        await readFile(join(test.projectDir, ".aidd", "manifest.json"), "utf-8")
      );
      const plugin = manifest.tools.antigravity.plugins.find(
        (p: { name: string }) => p.name === PLUGIN
      );
      expect(Object.keys(plugin.files).filter((path) => path.startsWith(".agents/hooks/"))).toEqual(
        []
      );
      expect(Object.keys(plugin.projectHooks.scripts)).toEqual([SCRIPT]);
    } finally {
      await test.cleanup();
    }
  });

  it("sync --force rewrites an edited hook script, restores a drifted skill and keeps the user hook", async () => {
    const test = await createTestEnv("antigravity-sync-force-script");
    try {
      const hooks = await installWithUserLintHook(test);
      const installed = await editScript(test);
      const skill = join(test.projectDir, OWN_SKILL);
      const skillInstalled = await readFile(skill, "utf-8");
      await writeFile(skill, `${skillInstalled}drift\n`);

      const sync = await runCli(["sync", "--force"], test.projectDir, test.fakeHome);

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(await readFile(join(test.projectDir, SCRIPT), "utf-8")).toBe(installed);
      expect(await readFile(skill, "utf-8")).toBe(skillInstalled);
      expect(await readHooks(test)).toEqual({ ...hooks, lint: LINT_HOOK });
    } finally {
      await test.cleanup();
    }
  });

  it("sync --force rewrites an edited hooks.json entry and keeps the user hook", async () => {
    const test = await createTestEnv("antigravity-sync-force-entry");
    try {
      const hooks = await installWithUserLintHook(test);
      await editEntry(test);

      const sync = await runCli(["sync", "--force"], test.projectDir, test.fakeHome);

      expect(sync.exitCode, sync.stderr).toBe(0);
      expect(await readHooks(test)).toEqual({ ...hooks, lint: LINT_HOOK });
    } finally {
      await test.cleanup();
    }
  });

  it("clean --force removes an edited hook and every plugin file, and keeps the user hook", async () => {
    const test = await createTestEnv("antigravity-clean-force-edited");
    try {
      await installWithUserLintHook(test);
      await editScript(test);
      await editEntry(test);

      const clean = await runCli(["clean", "--force"], test.projectDir, test.fakeHome);

      expect(clean.exitCode, clean.stderr).toBe(0);
      expect(existsSync(join(test.projectDir, SCRIPT))).toBe(false);
      expect(existsSync(join(test.projectDir, OWN_SKILL))).toBe(false);
      expect(await readHooks(test)).toEqual({ lint: LINT_HOOK });
    } finally {
      await test.cleanup();
    }
  });

  it("sync without --force refuses an edited hook script and names --force", async () => {
    const test = await createTestEnv("antigravity-sync-no-force");
    try {
      await installWithUserLintHook(test);
      await editScript(test);

      const sync = await runCli(["sync"], test.projectDir, test.fakeHome);

      expect(sync.exitCode).not.toBe(0);
      expect(`${sync.stdout}${sync.stderr}`).toMatch(/edited after install.*--force/);
    } finally {
      await test.cleanup();
    }
  });
});

describe("E2E: translate --as flat into an unparsable antigravity hooks file", () => {
  it("names the file and leaves it untouched", async () => {
    const test = await createTestEnv("antigravity-translate-bad-hooks");
    try {
      const out = join(test.projectDir, "out");
      const hooksFile = join(out, ".agents", "hooks.json");
      await mkdir(join(out, ".agents"), { recursive: true });
      await writeFile(hooksFile, "{ not json");

      const translate = await runCli(
        ["translate", FRAMEWORK_REAL_PATH, "--to", "antigravity", "--as", "flat", "--out", out],
        test.projectDir,
        test.fakeHome
      );

      expect(translate.exitCode).not.toBe(0);
      expect(translate.stderr).toContain(".agents/hooks.json is not valid JSON");
      expect(translate.stderr).toContain("left untouched");
      expect(await readFile(hooksFile, "utf-8")).toBe("{ not json");
    } finally {
      await test.cleanup();
    }
  });
});
