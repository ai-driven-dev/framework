/**
 * The memory hook as Kiro runs it: the plugin's SessionStart entry merged into
 * `.kiro/hooks/aidd.json`, its scripts installed with Kiro's host adapter, and the command run
 * from the session's folder on the SessionStart payload Kiro was seen sending.
 */
import { spawnSync } from "node:child_process";
import {
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
import { kiro } from "../../../../../../src/contexts/tools/domain/profiles/kiro/profile.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

const PLUGIN = "aidd-context";
const PLUGIN_HOOKS = join(REPOSITORY_ROOT, "plugins", PLUGIN, "hooks");
const PAYLOAD = join(
  REPOSITORY_ROOT,
  "scripts",
  "__tests__",
  "fixtures",
  "hook-payloads",
  "kiro-SessionStart.json"
);
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const LINK = "[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)";

const plugins = kiro.capabilities.plugins;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("the memory hook under Kiro", () => {
  let base: string;
  let project: string;
  let home: string;

  beforeEach(() => {
    base = realpathSync(mkdtempSync(join(tmpdir(), "aidd-kiro-memory-")));
    project = join(base, "project");
    home = join(base, "home");
    mkdirSync(join(project, "aidd_docs", "memory"), { recursive: true });
    mkdirSync(home);
    writeFileSync(join(project, "aidd_docs", "memory", "architecture.md"), "# Architecture\n");
    writeFileSync(join(project, "AGENTS.md"), `# Project\n\n${OPEN}\n${CLOSE}\n`);
  });

  afterEach(() => rmSync(base, { recursive: true, force: true }));

  /** Installs the plugin's hooks under `root` as `plugin install` does in a project and a flat
   * build does in a home, and returns its SessionStart command. */
  function install(root: string): string {
    const format = plugins.projectHooksFormat;
    const file = plugins.projectHooksRelativePath;
    if (format === null || file === null) throw new Error("kiro declares no project hooks");
    for (const source of filesUnder(PLUGIN_HOOKS)) {
      const pluginPath = `hooks/${relative(PLUGIN_HOOKS, source).split("\\").join("/")}`;
      if (pluginPath === "hooks/hooks.json") continue;
      const dest = join(root, format.scriptPath(PLUGIN, pluginPath));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, plugins.hookScript(pluginPath, readFileSync(source, "utf8")));
    }
    const { content } = format.merge(
      null,
      readFileSync(join(PLUGIN_HOOKS, "hooks.json"), "utf8"),
      PLUGIN
    );
    writeFileSync(join(root, file), content);
    const [first] = format
      .contributedEntries(content, PLUGIN)
      .filter(({ event }) => event === "SessionStart");
    if (first === undefined) throw new Error("no SessionStart entry was merged");
    return first.entry.command;
  }

  /** The captured payload, its scrubbed project path pointed at this project. */
  function payload(): string {
    const [sample] = (
      JSON.parse(readFileSync(PAYLOAD, "utf8")) as { samples: { payload: object }[] }
    ).samples;
    return JSON.stringify({ ...sample?.payload, cwd: project });
  }

  /** Runs the command as Kiro does: in the session's folder, its payload on stdin. */
  function runIn(command: string) {
    return spawnSync(command, {
      shell: true,
      cwd: project,
      input: payload(),
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, HOME: home, USERPROFILE: home },
    });
  }

  it("installs Kiro's own adapter as the hooks' host library", () => {
    install(project);

    expect(readFileSync(join(project, ".kiro/hooks", PLUGIN, "lib/host.cjs"), "utf8")).toContain(
      'const HOST = "kiro";'
    );
  });

  it("refreshes AGENTS.md on the SessionStart payload Kiro sends, from a project install", () => {
    const run = runIn(install(project));

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
    expect(readFileSync(join(project, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });

  it("refreshes the project's AGENTS.md from a home install, the project holding no .kiro", () => {
    const run = runIn(install(home));

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "", ""]);
    expect(readdirSync(project)).not.toContain(".kiro");
    expect(readFileSync(join(project, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });
});
