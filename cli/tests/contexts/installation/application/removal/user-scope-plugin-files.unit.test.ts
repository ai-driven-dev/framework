import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UserScopePluginFiles } from "../../../../../src/contexts/installation/application/removal/user-scope-plugin-files.js";
import { RecordedPlugin } from "../../../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const homedir = (): string => "/home/dev";

const HOME = "/fake-home";
const tool = registeredTools().aiProfile(TOOL.cursor);
const plugin = RecordedPlugin.fromMetadata({
  name: "aidd-context",
  version: "1.0.0",
  source: { kind: "local", path: "/p" },
  strict: false,
  scope: "user",
}).plugin;

describe("proving a user-scope plugin's files", () => {
  it("answers what the proof answers for this plugin, tool and home", async () => {
    const proof = new Map([["skills/x.md", "digest"]]);
    const seen: unknown[] = [];
    const files = new UserScopePluginFiles(
      { fs: new InMemoryFileAdapter(), platform: process.platform },
      async (...args) => {
        seen.push(args);
        return proof;
      }
    );

    await expect(files.proven(plugin, tool, HOME)).resolves.toBe(proof);
    expect(seen).toEqual([[plugin, tool, HOME]]);
  });
});

describe("deleting a user-scope plugin's files", () => {
  it("deletes the given files from the user plugins directory of the tool", async () => {
    const fs = new InMemoryFileAdapter();
    const target = join(tool.plugins()?.userPluginsBaseDir(homedir()) ?? "", "skills", "x.md");
    fs.setFile(target, "x");

    await new UserScopePluginFiles(
      { fs, platform: process.platform },
      async () => new Map()
    ).remove(new Map([["skills/x.md", "digest"]]), tool, {
      projectRoot: "/project",
      home: homedir(),
      plugin: plugin.name,
    });

    expect(fs.has(target)).toBe(false);
  });
});

describe("deleting the files of a user-scope plugin whose tool lists its rules in a guidance file", () => {
  const codex = registeredTools().aiProfile(TOOL.codex);
  const base = codex.plugins()?.userPluginsBaseDir(homedir()) ?? "";
  const listing =
    "# Mine\n\n<!-- aidd_plugin_rules:start -->\n- `~/.codex/instructions/aidd-context-*.md`\n<!-- aidd_plugin_rules:end -->\n";

  it("takes the plugin's listing out of that file, the person's own text kept", async () => {
    const fs = new InMemoryFileAdapter({ [join(base, "AGENTS.md")]: listing }, [base]);
    fs.setFile(join(base, "instructions/aidd-context-1-x.md"), "x");

    await new UserScopePluginFiles(
      { fs, platform: process.platform },
      async () => new Map()
    ).remove(new Map([["instructions/aidd-context-1-x.md", "digest"]]), codex, {
      projectRoot: "/project",
      home: homedir(),
      plugin: plugin.name,
    });

    expect([
      fs.has(join(base, "instructions/aidd-context-1-x.md")),
      fs.getFile(join(base, "AGENTS.md")),
    ]).toEqual([false, "# Mine\n"]);
  });
});
