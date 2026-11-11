/**
 * The memory hook as `agy` runs it: the plugin's SessionStart entry merged into
 * `.agents/hooks.json`, its scripts installed with Antigravity's host adapter, and the command
 * run from `<repo>/.agents` on the SessionStart payload `agy` was seen sending.
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
import { antigravity } from "../../../../../../src/contexts/tools/domain/profiles/antigravity/profile.js";
import { REPOSITORY_ROOT } from "../../../../../helpers/repository-root.js";

const PLUGIN = "aidd-context";
const PLUGIN_HOOKS = join(REPOSITORY_ROOT, "plugins", PLUGIN, "hooks");
const PAYLOAD = join(
  REPOSITORY_ROOT,
  "scripts",
  "__tests__",
  "fixtures",
  "hook-payloads",
  "antigravity-SessionStart.json"
);
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const LINK = "[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)";

const plugins = antigravity.capabilities.plugins;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("the memory hook under Antigravity", () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-agy-memory-")));
    mkdirSync(join(root, "aidd_docs", "memory"), { recursive: true });
    writeFileSync(join(root, "aidd_docs", "memory", "architecture.md"), "# Architecture\n");
    writeFileSync(join(root, "AGENTS.md"), `# Project\n\n${OPEN}\n${CLOSE}\n`);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Installs the plugin's hooks as `plugin install` does, and returns its SessionStart command. */
  function install(): string {
    const format = plugins.projectHooksDelivery()?.format;
    if (format === undefined) throw new Error("antigravity declares no project hooks format");
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
    writeFileSync(join(root, ".agents", "hooks.json"), content);
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
    return JSON.stringify({ ...sample?.payload, workspacePaths: [root] });
  }

  it("installs Antigravity's own adapter as the hooks' host library", () => {
    install();

    expect(readFileSync(join(root, ".agents/hooks", PLUGIN, "lib/host.cjs"), "utf8")).toContain(
      'const HOST = "antigravity";'
    );
  });

  it("refreshes AGENTS.md on the SessionStart payload agy sends, answering the {} it requires", () => {
    const command = install();
    cpSync(join(root, "AGENTS.md"), join(root, "AGENTS.before.md"));

    const run = spawnSync(command, {
      shell: true,
      cwd: join(root, ".agents"),
      input: payload(),
      encoding: "utf8",
      timeout: 10000,
    });

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "{}", ""]);
    expect(readFileSync(join(root, "AGENTS.before.md"), "utf8")).not.toContain(LINK);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });
});
