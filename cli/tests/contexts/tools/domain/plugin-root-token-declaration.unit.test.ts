import { describe, expect, it } from "vitest";
import { rewritePluginRootToken } from "../../../../src/contexts/tools/contract/plugin-root-token.js";
import { claude } from "../../../../src/contexts/tools/domain/profiles/claude/claude.profile.js";
import { registeredAiConfig } from "../../../shared/testing/catalog-of.builder.js";
import { nativeOf } from "../../../shared/testing/native-plugin-answers.builder.js";
import { present } from "../../../shared/testing/present.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

/** A hook whose command names a variable the host does not expand installs cleanly, runs on
 * every event, and silently does nothing, so the variable each tool expands is declared beside
 * the rest of what that tool supports. The conformance suite holds every tool's build contract to
 * its declaration; this holds the rewrite to the variable authors write. */

describe("the route that builds a marketplace bundle", () => {
  it("leaves a command alone for the tool whose variable is the one authors write", () => {
    const native = nativeOf(registeredAiConfig(TOOL.claude).plugins());
    const authored = `node ${native.rootToken()}/hooks/journal.cjs`;

    const token = present(claude.buildContracts.marketplace)().pluginRootToken;

    expect(rewritePluginRootToken(authored, token ?? "")).toBe(authored);
  });
});
