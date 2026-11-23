import { describe, expect, it } from "vitest";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import { claude } from "../../../../../src/contexts/tools/domain/profiles/claude/claude.profile.js";
import { codexProfile } from "../../../../../src/contexts/tools/domain/profiles/codex/codex.profile.js";
import { copilot } from "../../../../../src/contexts/tools/domain/profiles/copilot/copilot.profile.js";
import { cursor } from "../../../../../src/contexts/tools/domain/profiles/cursor/cursor.profile.js";
import { opencode } from "../../../../../src/contexts/tools/domain/profiles/opencode/opencode.profile.js";
import { SmolTomlCodec } from "../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { PluginDistribution } from "../../../../../src/shared/domain/plugin/plugin-distribution.js";
import { parsePluginName } from "../../../../../src/shared/domain/plugin/plugin-name.js";
import { nativeOf } from "../../../../shared/testing/native-plugin-answers.builder.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { hooksAcceptanceOf } from "../../testing/plugin-mode.builder.js";
import { translatePluginIntoProject } from "../../testing/translate-plugin.builder.js";
import type { WithSections } from "../../testing/with-sections.builder.js";

const codex = codexProfile(new SmolTomlCodec());

/** A hook that arrives is not a hook that runs: every failure this covers installed cleanly
 * and did nothing. */

const SOURCE_TOKEN = nativeOf(claude.plugins()).rootToken() ?? "";
const HOOK_COMMAND = `node ${SOURCE_TOKEN}/hooks/journal.cjs session-start`;
const SCRIPT = `#!/usr/bin/env node\n// carries ${SOURCE_TOKEN} in a comment\n`;
const HOOKS_JSON = JSON.stringify({
  hooks: { SessionStart: [{ hooks: [{ type: "command", command: HOOK_COMMAND }] }] },
});

const HOOK_HOSTS: ReadonlyArray<AiTool<WithSections<"layout">>> = [claude, cursor, copilot, codex];

const MCP_JSON = JSON.stringify({
  mcpServers: { local: { command: `${SOURCE_TOKEN}/bin/server.js`, args: [] } },
});

function pluginWithHookAndScript(): PluginDistribution {
  const hooks = [
    { relativePath: "hooks/hooks.json", content: HOOKS_JSON },
    { relativePath: "hooks/journal.cjs", content: SCRIPT },
  ];
  const mcp = [{ relativePath: ".mcp.json", content: MCP_JSON }];
  return new PluginDistribution({
    manifest: { name: parsePluginName("aidd-telemetry"), version: "1.0.0" },
    format: TOOL.claude,
    files: [...hooks, ...mcp],
    components: { commands: [], agents: [], rules: [], skills: [], hooks, mcp },
  });
}

function installedFor(tool: AiTool<WithSections<"layout">>) {
  return translatePluginIntoProject(pluginWithHookAndScript(), tool);
}

function contentEndingWith(
  result: ReturnType<typeof installedFor>,
  suffix: string
): string | undefined {
  return result.files.find((file) => file.relativePath.endsWith(suffix))?.content;
}

/** What a hook command opens with: the variable the tool expands, or, for a tool keeping its
 * hooks in the project, where its scripts land there. */
function expectedRoot(tool: AiTool<WithSections<"layout">>): string {
  return (
    tool.projectHooksDelivery()?.format.scriptDir("aidd-telemetry") ??
    nativeOf(tool.plugins()).rootToken() ??
    ""
  );
}

describe("installing a plugin that ships hooks", () => {
  it("delivers them to every tool that runs hooks", () => {
    for (const tool of HOOK_HOSTS) {
      expect(installedFor(tool).files, tool.toolId).not.toHaveLength(0);
    }
  });

  it("writes a command naming the variable that tool expands, never another tool's", () => {
    for (const tool of HOOK_HOSTS) {
      const manifest = contentEndingWith(installedFor(tool), "hooks.json") ?? "";

      expect(manifest, tool.toolId).toContain(expectedRoot(tool));
      if (nativeOf(tool.plugins()).rootToken() === SOURCE_TOKEN) continue;
      expect(manifest, tool.toolId).not.toContain(SOURCE_TOKEN);
    }
  });

  it("leaves a script beside the hook byte for byte, its plugin root untouched", () => {
    // Measured: rewriting a script's content changed it by six bytes on one tool and lost
    // one on another. A script is carried, never translated.
    for (const tool of HOOK_HOSTS) {
      expect(contentEndingWith(installedFor(tool), "journal.cjs"), tool.toolId).toBe(SCRIPT);
    }
  });

  it("points an mcp server at the plugin root the target tool expands", () => {
    // The one place the substitution changes an installed byte: Cursor's own converter
    // rewrites a hook manifest wholesale, every other tool expands the source's spelling.
    for (const tool of HOOK_HOSTS) {
      const served = contentEndingWith(
        installedFor(tool),
        nativeOf(tool.plugins()).mcpFile().relativePath
      );

      // A tool that delivered no mcp file would pass the assertion below by never
      // reaching it, which is the failure shape this whole file exists to catch.
      expect(served, `${tool.toolId} installed no mcp file to check`).toBeDefined();
      expect(served, tool.toolId).toContain(nativeOf(tool.plugins()).rootToken());
    }
  });

  it("delivers OpenCode's script under flatHooksDir instead of skipping it (Phase 7)", () => {
    const result = installedFor(opencode);

    expect(result.skipped).toEqual([]);
    const flatHooksDir = ".opencode/hooks/";
    expect(contentEndingWith(result, "journal.cjs")).toBe(SCRIPT);
    expect(result.files.some((file) => file.relativePath === `${flatHooksDir}hooks.json`)).toBe(
      false
    );
  });
});

describe("what a tool says about the hooks it runs", () => {
  it("never leaves its answer to a default", () => {
    for (const tool of [...HOOK_HOSTS, opencode]) {
      const acceptance = hooksAcceptanceOf(tool);

      expect(acceptance.accepts || acceptance.reason.length > 0, tool.toolId).toBe(true);
    }
  });
});
