/**
 * The memory hook as Kiro runs it: the plugin's SessionStart entry merged into
 * `.kiro/hooks/aidd.json`, its scripts installed with Kiro's host adapter, and the command
 * run from the project on the SessionStart payload Kiro was seen sending. The home is a
 * temporary one, so a script installed there never answers for the project's.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
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

  function installScript(
    format: NonNullable<ReturnType<typeof kiro.projectHooksDelivery>>["format"],
    source: string
  ): void {
    const pluginPath = `hooks/${relative(PLUGIN_HOOKS, source).split("\\").join("/")}`;
    if (pluginPath === "hooks/hooks.json") return;
    const dest = join(root, format.scriptPath(PLUGIN, pluginPath));
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

  /** Installs the plugin's hooks as `plugin install` does, and returns its SessionStart command. */
  function install(): string {
    const format = kiro.projectHooksDelivery()?.format;
    if (format === undefined) throw new Error("kiro declares no project hooks format");
    for (const source of filesUnder(PLUGIN_HOOKS)) installScript(format, source);
    const { content } = format.merge(
      null,
      readFileSync(join(PLUGIN_HOOKS, "hooks.json"), "utf8"),
      PLUGIN
    );
    mkdirSync(join(root, ".kiro/hooks"), { recursive: true });
    writeFileSync(join(root, ".kiro/hooks/aidd.json"), content);
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

  it("installs Kiro's own adapter as the hooks' host library", () => {
    install();

    expect(readFileSync(join(root, ".kiro/hooks", PLUGIN, "lib/host.cjs"), "utf8")).toContain(
      'const HOST = "kiro";'
    );
  });

  it("refreshes AGENTS.md on the SessionStart payload Kiro sends, printing nothing for the model", () => {
    const command = install();
    cpSync(join(root, "AGENTS.md"), join(root, "AGENTS.before.md"));

    const run = spawnSync(command, {
      shell: true,
      cwd: root,
      env: { ...process.env, HOME: join(root, "home"), USERPROFILE: join(root, "home") },
      input: payload(),
      encoding: "utf8",
      timeout: 10000,
    });

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
    expect(readFileSync(join(root, "AGENTS.before.md"), "utf8")).not.toContain(LINK);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });
});
