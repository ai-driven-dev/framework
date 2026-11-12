import { describe, expect, it } from "vitest";
import { buildClaudeContract } from "../../../../src/contexts/tools/domain/profiles/claude/build.js";
import { rewritePluginRootToken } from "../../../../src/contexts/translate/domain/formats/plugin-root-token-rewrite.js";
import { registeredAiConfig } from "../testing/catalog-of.js";
import { nativeOf } from "../testing/plugin-mode.js";

/** A hook whose command names a variable the host does not expand installs cleanly, runs on
 * every event, and silently does nothing, so the variable each tool expands is declared beside
 * the rest of what that tool supports. The conformance suite holds every tool's build contract to
 * its declaration; this holds the rewrite to the variable authors write. */

describe("the route that builds a marketplace bundle", () => {
  it("leaves a command alone for the tool whose variable is the one authors write", () => {
    const claude = nativeOf(registeredAiConfig("claude").section("plugins") ?? undefined);
    const authored = `node ${claude.rootToken()}/hooks/journal.cjs`;

    const token = buildClaudeContract().pluginRootToken;

    expect(rewritePluginRootToken(authored, token ?? "")).toBe(authored);
  });
});
