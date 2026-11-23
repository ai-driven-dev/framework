import { describe, expect, it } from "vitest";
import { claude } from "../../../../../src/composition/tool-profiles/claude.js";
import { codexSpec } from "../../../../../src/composition/tool-profiles/codex.js";
import { copilot } from "../../../../../src/composition/tool-profiles/copilot.js";
import { cursor } from "../../../../../src/composition/tool-profiles/cursor.js";
import { opencode } from "../../../../../src/composition/tool-profiles/opencode.js";
import { rewritePluginRootToken } from "../../../../../src/contexts/tools/contract/plugin-root-token.js";
import { defineAiTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { SmolTomlCodec } from "../../../../../src/shared/infrastructure/smol-toml-codec.adapter.js";
import { nativeOf } from "../../../../shared/testing/native-plugin-answers.builder.js";
import { present } from "../../../../shared/testing/present.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { hooksAcceptanceOf } from "../../testing/plugin-mode.builder.js";
import { translatePluginIntoProject } from "../../testing/translate-plugin.builder.js";
import type { WithSections } from "../../testing/with-sections.builder.js";

const TOML = new SmolTomlCodec();
const codex = defineAiTool(codexSpec, { toml: TOML });

/**
 * A hook command pointing at nothing installs clean and does nothing, so the command is read
 * back out of what was installed and the file it names is looked for.
 */

const PLUGIN = "aidd-telemetry";
const SOURCE_TOKEN = nativeOf(claude.plugins()).rootToken() ?? "";
const SCRIPTS = ["hooks/journal.cjs", "hooks/lib/record.cjs"];
const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [
      {
        hooks: [
          { type: "command", command: `node ${SOURCE_TOKEN}/hooks/journal.cjs session-start` },
        ],
      },
    ],
  },
});

const HOOK_HOSTS: ReadonlyArray<AiTool<WithSections<"layout">>> = [claude, cursor, copilot, codex];

function distribution(): PluginDistribution {
  const hooks = [
    { relativePath: "hooks/hooks.json", content: HOOKS_JSON },
    ...SCRIPTS.map((relativePath) => ({ relativePath, content: "// a script\n" })),
  ];
  return new PluginDistribution({
    manifest: { name: parsePluginName(PLUGIN), version: "1.0.0" },
    format: TOOL.claude,
    files: hooks,
    components: { commands: [], agents: [], rules: [], skills: [], hooks, mcp: [] },
  });
}

/** Every path a hook command names, as the tool would resolve it: its own plugin-root
 * variable and a leading `./` both mean the plugin's own directory. */
function commandTargets(manifest: string, tool: AiTool<WithSections<"layout">>): string[] {
  const token = nativeOf(tool.plugins()).rootToken() ?? "";
  const kept = tool.projectHooksDelivery()?.format.scriptDir(PLUGIN);
  return [...manifest.matchAll(/"command":\s*"([^"]+)"/gu)]
    .flatMap((match) => (match[1] ?? "").split(" "))
    .filter((word) => word.includes("/") && !word.startsWith("-"))
    .map((word) => word.replace(token, "").replace(/^\.\//u, "").replace(/^\//u, ""))
    .map((word) => inPlugin(word, kept));
}

/** A tool keeping its hooks in the project lays a plugin's scripts out under its own directory
 * there; the plugin's own file is what remains once that directory is read as `hooks/`. */
function inPlugin(path: string, projectScriptDir: string | undefined): string {
  return projectScriptDir !== undefined && path.startsWith(projectScriptDir)
    ? `hooks/${path.slice(projectScriptDir.length)}`
    : path;
}

function installed(tool: AiTool<WithSections<"layout">>): { paths: string[]; manifest: string } {
  const { files } = translatePluginIntoProject(distribution(), tool);
  const root = nativeOf(tool.plugins()).pluginOutputDir(PLUGIN) ?? "";
  const kept = tool.projectHooksDelivery()?.format.scriptDir(PLUGIN);
  return {
    paths: files.map(({ relativePath }) =>
      inPlugin(relativePath.startsWith(root) ? relativePath.slice(root.length) : relativePath, kept)
    ),
    manifest: files.find((file) => file.relativePath.endsWith("hooks.json"))?.content ?? "",
  };
}

describe("a hook that was installed", () => {
  it("names a file the same install put there", () => {
    for (const tool of HOOK_HOSTS) {
      const { paths, manifest } = installed(tool);
      const targets = commandTargets(manifest, tool);

      // An installed hook that names nothing would pass every assertion below by never
      // reaching them, which is the failure shape this whole file exists to catch.
      expect(targets, `${tool.toolId} installed no hook command to check`).not.toHaveLength(0);
      for (const target of targets) {
        expect(
          paths,
          `${tool.toolId} hook names ${target}; delivered ${paths.join(", ")}`
        ).toContain(target);
      }
    }
  });

  it("names something at all, rather than a variable the tool leaves as text", () => {
    for (const tool of HOOK_HOSTS) {
      const { manifest } = installed(tool);
      expect(commandTargets(manifest, tool), tool.toolId).not.toHaveLength(0);
      if (nativeOf(tool.plugins()).rootToken() === SOURCE_TOKEN) continue;

      expect(manifest, tool.toolId).not.toContain(SOURCE_TOKEN);
    }
  });

  it("carries every script the hook could reach, not only the one it names", () => {
    for (const tool of HOOK_HOSTS) {
      const { paths } = installed(tool);

      expect(paths, tool.toolId).toEqual(expect.arrayContaining(SCRIPTS));
    }
  });
});

/** The two routes write different layouts by design - one a bundle, the other a tool's own
 * directory - so what has to agree is the plugin's own file the command names. */
const BUILT_BY: ReadonlyArray<
  [AiTool<WithSections<"layout">>, () => { pluginRootToken?: string | null }]
> = [
  [claude, () => present(claude.buildContracts.marketplace)()],
  [cursor, () => present(cursor.buildContracts.marketplace)()],
  [copilot, () => present(copilot.buildContracts.marketplace)()],
  [codex, () => present(codex.buildContracts.marketplace)()],
];

describe("the two ways a plugin gets installed", () => {
  it("point a hook at the same file, whichever route delivered it", () => {
    for (const [tool, buildContract] of BUILT_BY) {
      const built = rewritePluginRootToken(HOOKS_JSON, buildContract().pluginRootToken ?? "");
      const fromBuild = commandTargets(built, tool);

      expect(fromBuild, tool.toolId).not.toHaveLength(0);
      expect(fromBuild, tool.toolId).toEqual(commandTargets(installed(tool).manifest, tool));
    }
  });

  it("deliver hooks exactly when the tool runs them", () => {
    for (const tool of [...HOOK_HOSTS, opencode]) {
      const { files, skipped } = translatePluginIntoProject(distribution(), tool);
      const carriesHooks = files.some((file) => file.relativePath.endsWith(".cjs"));

      expect(carriesHooks, tool.toolId).toBe(hooksAcceptanceOf(tool).accepts);
      expect(skipped.length > 0, tool.toolId).toBe(!hooksAcceptanceOf(tool).accepts);
    }
  });
});
