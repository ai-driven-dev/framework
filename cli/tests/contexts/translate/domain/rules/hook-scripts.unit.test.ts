import { describe, expect, it } from "vitest";
import { PLUGIN_HOOKS_RELATIVE } from "../../../../../src/contexts/translate/domain/canon-format.js";
import {
  hookScripts,
  projectHooks,
  withoutHooks,
} from "../../../../../src/contexts/translate/domain/rules/hook-scripts.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { cursor } from "../../testing/registered-profiles.builder.js";

const at = (relativePath: string, content: string) => ({
  relativePath: `out/${relativePath}`,
  content,
});

describe("hookScripts", () => {
  it("places every script and leaves out the plugin's own manifest", () => {
    const files = [
      { relativePath: PLUGIN_HOOKS_RELATIVE, content: "{}" },
      { relativePath: "hooks/a.cjs", content: "a" },
    ];

    expect(hookScripts(files, at)).toStrictEqual([
      { relativePath: "out/hooks/a.cjs", content: "a" },
    ]);
  });

  it("takes a hooks.json further down as a script", () => {
    const files = [{ relativePath: "hooks/sub/hooks.json", content: "{}" }];

    expect(hookScripts(files, at).map((file) => file.relativePath)).toStrictEqual([
      "out/hooks/sub/hooks.json",
    ]);
  });

  it("drops a script the layout takes none of", () => {
    expect(hookScripts([{ relativePath: "hooks/a.cjs", content: "a" }], () => null)).toStrictEqual(
      []
    );
  });
});

const MANIFEST = { relativePath: PLUGIN_HOOKS_RELATIVE, content: "{}" };
const SCRIPT = { relativePath: "hooks/pre.js", content: "code" };
const COMMAND = { relativePath: "commands/hello.md", content: "# Hello" };

function distWith(hooks: readonly { relativePath: string; content: string }[]) {
  return new PluginDistribution({
    manifest: { name: "aidd-context", version: "1.0.0" },
    format: TOOL.claude,
    files: [...hooks, COMMAND],
    components: {
      commands: [COMMAND],
      agents: [],
      rules: [],
      skills: [],
      hooks: [...hooks],
      mcp: [],
    },
  });
}

describe("projectHooks", () => {
  const location = cursor.projectHooksDelivery();
  if (location === null) throw new Error("cursor delivers project hooks");

  it("keeps the manifest apart and places each script where the tool declares", () => {
    const delivered = projectHooks(distWith([MANIFEST, SCRIPT]), location);

    expect(delivered).toStrictEqual({
      manifest: "{}",
      scripts: [
        {
          source: SCRIPT.relativePath,
          relativePath: location.format.scriptPath("aidd-context", SCRIPT.relativePath),
          content: location.hookScript(SCRIPT.relativePath, SCRIPT.content),
        },
      ],
    });
  });

  it("hands the tool's own adapter in place of the plugin's", () => {
    const host = { relativePath: "hooks/lib/host.cjs", content: "claude adapter" };

    const [script] = projectHooks(distWith([host]), location).scripts;

    expect(script?.content).not.toBe(host.content);
    expect(script?.content).toBe(location.hookScript(host.relativePath, host.content));
  });

  it("has no manifest when the plugin ships none", () => {
    expect(projectHooks(distWith([SCRIPT]), location).manifest).toBeNull();
  });
});

describe("withoutHooks", () => {
  it("drops every hooks file from the file list and the hooks component alike", () => {
    const stripped = withoutHooks(distWith([MANIFEST, SCRIPT]));

    expect(stripped.files).toStrictEqual([COMMAND]);
    expect(stripped.components.hooks).toStrictEqual([]);
    expect(stripped.components.commands).toStrictEqual([COMMAND]);
  });
});
