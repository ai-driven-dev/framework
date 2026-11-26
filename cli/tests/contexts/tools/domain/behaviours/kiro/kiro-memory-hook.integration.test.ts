/**
 * The memory hook as Kiro runs it: the plugin's SessionStart entry merged into
 * `.kiro/hooks/aidd.json`, its scripts installed with Kiro's host adapter, and the command
 * run from the project on the SessionStart payload Kiro was seen sending. The home is a
 * temporary one, so a script installed there never answers for the project's.
 */
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { kiro } from "../../../../../../src/composition/tool-profiles/kiro.js";
import { REPOSITORY_ROOT } from "../../../../../shared/testing/repository-root.builder.js";
import { sample } from "../../../testing/hooks-runtime-host.builder.js";
import { flatOf } from "../../../testing/plugin-mode.builder.js";

const PLUGIN = "aidd-context";
const PLUGIN_HOOKS = join(REPOSITORY_ROOT, "plugins", PLUGIN, "hooks");
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const LINK = "[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)";

const plugins = flatOf(kiro.plugins());

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("the memory hook under Kiro", () => {
  let root: string;
  const HOME = () => join(root, "home");

  function installScript(
    base: string,
    format: NonNullable<ReturnType<typeof kiro.projectHooksDelivery>>["format"],
    source: string
  ): void {
    const pluginPath = `hooks/${relative(PLUGIN_HOOKS, source).split("\\").join("/")}`;
    if (pluginPath === "hooks/hooks.json") return;
    const dest = join(base, format.scriptPath(PLUGIN, pluginPath));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, plugins.hookScript(pluginPath, readFileSync(source, "utf8")));
  }

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-kiro-memory-")));
    mkdirSync(join(root, "aidd_docs", "memory"), { recursive: true });
    mkdirSync(join(root, "home"), { recursive: true });
    writeFileSync(join(root, "aidd_docs", "memory", "architecture.md"), "# Architecture\n");
    writeFileSync(join(root, "AGENTS.md"), `# Project\n\n${OPEN}\n${CLOSE}\n`);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Installs the plugin's hooks under `base`, as `plugin install` does for a project, and returns
   * its SessionStart command. */
  function install(base = root): string {
    const format = kiro.projectHooksDelivery()?.format;
    if (format === undefined) throw new Error("kiro declares no project hooks format");
    for (const source of filesUnder(PLUGIN_HOOKS)) installScript(base, format, source);
    const { content } = format.merge(
      null,
      readFileSync(join(PLUGIN_HOOKS, "hooks.json"), "utf8"),
      PLUGIN
    );
    mkdirSync(join(base, ".kiro/hooks"), { recursive: true });
    writeFileSync(join(base, ".kiro/hooks/aidd.json"), content);
    const [first] = format
      .contributedEntries(content, PLUGIN)
      .filter(({ event }) => event === "SessionStart");
    if (first === undefined) throw new Error("no SessionStart entry was merged");
    return first.entry.command;
  }

  /** The captured payload, its scrubbed project path pointed at this project. */
  function payload(): string {
    return JSON.stringify({ ...sample("kiro-SessionStart.json", 0).payload, cwd: root });
  }

  /** Runs the command as Kiro does, from the project, with the temporary home as the home. */
  function runHook(command: string): SpawnSyncReturns<string> {
    return spawnSync(command, {
      shell: true,
      cwd: root,
      env: { ...process.env, HOME: HOME(), USERPROFILE: HOME() },
      input: payload(),
      encoding: "utf8",
      timeout: 10000,
    });
  }

  it("installs Kiro's own adapter as the hooks' host library", () => {
    install();

    expect(readFileSync(join(root, ".kiro/hooks", PLUGIN, "lib/host.cjs"), "utf8")).toContain(
      'const HOST = "kiro";'
    );
  });

  it("refreshes AGENTS.md on the SessionStart payload Kiro sends, printing nothing for the model", () => {
    const command = install();
    cpSync(join(root, "AGENTS.md"), join(root, "AGENTS.before.md"));

    const run = runHook(command);

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
    expect(readFileSync(join(root, "AGENTS.before.md"), "utf8")).not.toContain(LINK);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });

  it("refreshes the project's AGENTS.md from a home install, the project holding no .kiro", () => {
    const command = install(HOME());

    const run = runHook(command);

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });

  it("prefers the home copy, so a repository cannot have its own script run by a home install", () => {
    const command = install(HOME());
    install();
    const script = /r='([^']+)'/.exec(command)?.[1];
    if (script === undefined) throw new Error("the command names no script");
    for (const [base, marker] of [
      [HOME(), "ran-home"],
      [root, "ran-project"],
    ]) {
      writeFileSync(
        join(base ?? root, script),
        `require("node:fs").writeFileSync(${JSON.stringify(join(root, marker))}, "");`
      );
    }

    runHook(command);

    expect([
      existsSync(join(root, "ran-home")),
      existsSync(join(root, "ran-project")),
    ]).toStrictEqual([true, false]);
  });

  /** Runs a script with `body` as the hook of `event`, through the command Kiro is given. */
  function runScript(event: string, body: string): SpawnSyncReturns<string> {
    const format = kiro.projectHooksDelivery()?.format;
    if (format === undefined) throw new Error("kiro declares no project hooks format");
    const { content } = format.merge(
      null,
      JSON.stringify({
        hooks: {
          [event]: [
            {
              hooks: [
                { type: "command", command: `node ${"$"}{CLAUDE_PLUGIN_ROOT}/hooks/script.cjs` },
              ],
            },
          ],
        },
      }),
      PLUGIN
    );
    const [entry] = format.contributedEntries(content, PLUGIN);
    if (entry === undefined) throw new Error("no entry was merged");
    const script = join(HOME(), format.scriptPath(PLUGIN, "hooks/script.cjs"));
    mkdirSync(dirname(script), { recursive: true });
    writeFileSync(script, body);
    return runHook(entry.entry.command);
  }

  it.each([
    ["SessionStart", 'throw new Error("boom");'],
    ["PostToolUse", 'throw new Error("boom");'],
    ["Stop", 'throw new Error("boom");'],
    ["Stop", 'process.kill(process.pid, "SIGKILL");'],
  ])(
    "ends with a neutral exit when the %s script crashes (%s), because Kiro continues the turn on exit 1",
    (event, body) => {
      const run = runScript(event, body);

      expect([run.status, run.stdout]).toStrictEqual([0, ""]);
      expect(run.stderr).toContain("hook script failed");
    }
  );

  it("keeps a refusal: exit 2 with its reason on stderr, which Kiro hands to the model", () => {
    const run = runScript(
      "PostToolUse",
      'process.stderr.write("not this file"); process.exitCode = 2;'
    );

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([2, "", "not this file"]);
  });
});
