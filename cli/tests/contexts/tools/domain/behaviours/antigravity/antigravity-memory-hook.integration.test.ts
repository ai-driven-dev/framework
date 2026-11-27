/**
 * The memory hook as `agy` runs it: the plugin's hooks written as its own `hooks.json`, its
 * scripts installed with Antigravity's host adapter, and the command run from the plugin's
 * directory on the SessionStart payload `agy` was seen sending.
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
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { antigravity } from "../../../../../../src/composition/tool-profiles/antigravity.js";
import { posixRelative } from "../../../../../../src/shared/domain/paths.model.js";
import { nativeOf } from "../../../../../shared/testing/native-plugin-answers.builder.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { REPOSITORY_ROOT } from "../../../../../shared/testing/repository-root.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";
import { sample } from "../../../testing/hooks-runtime-host.builder.js";

const PLUGIN = "aidd-context";
const PLUGIN_HOOKS = join(REPOSITORY_ROOT, "plugins", PLUGIN, "hooks");
const PLUGIN_ROUTE_SAMPLE = 2;
const OPEN = "<!-- aidd_project_memory:start -->";
const CLOSE = "<!-- aidd_project_memory:end -->";
const LINK = "[aidd_docs/memory/architecture.md](aidd_docs/memory/architecture.md)";

const plugins = nativeOf(antigravity.plugins());
const PLUGIN_DIR = join(".agents", "plugins", PLUGIN);

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

describe("the memory hook under Antigravity", () => {
  let root: string;

  function installScript(source: string): void {
    const pluginPath = `hooks/${posixRelative(PLUGIN_HOOKS, source, process.platform)}`;
    if (pluginPath === "hooks/hooks.json") return;
    const dest = join(root, PLUGIN_DIR, pluginPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, plugins.hookScript(pluginPath, readFileSync(source, "utf8")));
  }

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "aidd-agy-memory-")));
    mkdirSync(join(root, "aidd_docs", "memory"), { recursive: true });
    writeFileSync(join(root, "aidd_docs", "memory", "architecture.md"), "# Architecture\n");
    writeFileSync(join(root, "AGENTS.md"), `# Project\n\n${OPEN}\n${CLOSE}\n`);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  /** Installs the plugin's hooks as `plugin install` does, and returns its SessionStart command. */
  function install(): string {
    for (const source of filesUnder(PLUGIN_HOOKS)) installScript(source);
    const hooks = supported(present(antigravity.buildContracts.marketplace)().artifacts.hooks);
    const content = hooks.transform?.(
      readFileSync(join(PLUGIN_HOOKS, "hooks.json"), "utf8"),
      PLUGIN,
      "hooks.json"
    );
    if (content === undefined) throw new Error("antigravity converts no hooks file");
    writeFileSync(join(root, PLUGIN_DIR, plugins.hooksFilePath()), content);
    const [first] = JSON.parse(content)[PLUGIN].SessionStart;
    return first.command;
  }

  /** The payload captured from a plugin's own `hooks.json`, its scrubbed project path pointed at
   * this project. */
  function payload(): string {
    return JSON.stringify({
      ...sample("antigravity-SessionStart.json", PLUGIN_ROUTE_SAMPLE).payload,
      workspacePaths: [root],
    });
  }

  it("installs Antigravity's own adapter as the hooks' host library", () => {
    install();

    expect(readFileSync(join(root, PLUGIN_DIR, "hooks/lib/host.cjs"), "utf8")).toContain(
      'const HOST = "antigravity";'
    );
  });

  it("refreshes AGENTS.md on the SessionStart payload agy sends, answering the {} it requires", () => {
    const command = install();
    cpSync(join(root, "AGENTS.md"), join(root, "AGENTS.before.md"));

    const run = spawnSync(command, {
      shell: true,
      cwd: join(root, PLUGIN_DIR),
      input: payload(),
      encoding: "utf8",
      timeout: 10000,
    });

    expect([run.status, run.stdout, run.stderr]).toStrictEqual([0, "{}", ""]);
    expect(readFileSync(join(root, "AGENTS.before.md"), "utf8")).not.toContain(LINK);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8").split("\n")).toContain(LINK);
  });
});
