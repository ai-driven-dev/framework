import { describe, expect, it } from "vitest";
import type { PluginsCapability } from "../../../../src/contexts/tools/domain/capabilities/plugins-capability.js";
import { buildClaudeContract } from "../../../../src/contexts/tools/domain/profiles/claude/build.js";
import { buildCodexContract } from "../../../../src/contexts/tools/domain/profiles/codex/build.js";
import { buildCopilotMarketplaceContract } from "../../../../src/contexts/tools/domain/profiles/copilot/build.js";
import { buildCursorContract } from "../../../../src/contexts/tools/domain/profiles/cursor/build.js";
import { getAiToolConfig } from "../../../../src/contexts/tools/domain/registry.js";
import { rewritePluginRootToken } from "../../../../src/contexts/translate/domain/formats/plugin-root-token-rewrite.js";
import type { AiToolId } from "../../../../src/kernel/tool.js";

/** A hook whose command names a variable the host does not expand installs cleanly, runs on
 * every event, and silently does nothing, so the variable each tool expands is declared beside
 * the rest of what that tool supports. These hold the two install routes to that declaration. */

const CONTRACTS: ReadonlyArray<[AiToolId, () => { pluginRootToken?: string | null }]> = [
  ["claude", buildClaudeContract],
  ["cursor", buildCursorContract],
  ["copilot", buildCopilotMarketplaceContract],
  ["codex", buildCodexContract],
];

function pluginsOf(tool: AiToolId): PluginsCapability | undefined {
  return getAiToolConfig(tool).section("plugins") ?? undefined;
}

describe("the route that builds a marketplace bundle", () => {
  // Two places naming the same variable is how they start disagreeing, and the failure
  // would be silent on the side nobody looks at.
  it("substitutes the token the tool itself declared", () => {
    for (const [tool, buildContract] of CONTRACTS) {
      expect(buildContract().pluginRootToken, tool).toBe(pluginsOf(tool)?.rootToken());
    }
  });

  it("leaves a command alone for the tool whose variable is the one authors write", () => {
    const authored = `node ${pluginsOf("claude")?.rootToken()}/hooks/journal.cjs`;

    const token = buildClaudeContract().pluginRootToken;

    expect(rewritePluginRootToken(authored, token ?? "")).toBe(authored);
  });
});
