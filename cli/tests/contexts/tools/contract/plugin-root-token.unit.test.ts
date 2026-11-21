import { describe, expect, it } from "vitest";
import { rewritePluginRootToken } from "../../../../src/contexts/tools/contract/plugin-root-token.js";
import { SOURCE_PLUGIN_ROOT_TOKEN } from "../../../../src/shared/domain/materialization/plugin-root-path-rewrite.js";
import { registeredAiConfig } from "../../../shared/testing/catalog-of.builder.js";
import { nativeOf } from "../../../shared/testing/native-plugin-answers.builder.js";
import { buildContractOf } from "../../../shared/testing/registered-build-contracts.builder.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";

// Avoid biome noTemplateCurlyInString: split literals
const CLAUDE_TOKEN = "$" + "{CLAUDE_PLUGIN_ROOT}";
const CURSOR_TOKEN = "$" + "{CURSOR_PLUGIN_ROOT}";
const CODEX_TOKEN = "$" + "{PLUGIN_ROOT}";
const COPILOT_TOKEN = "$" + "{COPILOT_PLUGIN_ROOT}";

describe("rewritePluginRootToken", () => {
  describe("claude no-op (token equals source)", () => {
    it("returns content unchanged when target equals the source token", () => {
      const content = `node ${CLAUDE_TOKEN}/hooks/update.js`;
      expect(rewritePluginRootToken(content, CLAUDE_TOKEN)).toBe(content);
    });

    it("returns the exact same string reference (no copy)", () => {
      const content = `node ${CLAUDE_TOKEN}/hooks/update.js`;
      const result = rewritePluginRootToken(content, CLAUDE_TOKEN);
      expect(result).toBe(content);
    });
  });

  describe("cursor substitution", () => {
    it("rewrites the claude token to the cursor native token", () => {
      const content = `node ${CLAUDE_TOKEN}/hooks/update.js`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).toBe(`node ${CURSOR_TOKEN}/hooks/update.js`);
    });

    it("preserves path separator after token", () => {
      const content = `${CLAUDE_TOKEN}/hooks/check.sh`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).toContain(`${CURSOR_TOKEN}/hooks/`);
    });

    it("does not contain the claude token after rewrite", () => {
      const content = `${CLAUDE_TOKEN}/hooks/check.sh`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).not.toContain(CLAUDE_TOKEN);
    });

    it("rewrites all occurrences in content", () => {
      const content = `${CLAUDE_TOKEN}/hooks/a.sh and ${CLAUDE_TOKEN}/hooks/b.sh`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).toBe(`${CURSOR_TOKEN}/hooks/a.sh and ${CURSOR_TOKEN}/hooks/b.sh`);
    });
  });

  describe("codex substitution", () => {
    it("rewrites the claude token to the codex native token", () => {
      const content = `"command": "${CLAUDE_TOKEN}/hooks/update.js"`;
      const result = rewritePluginRootToken(content, CODEX_TOKEN);
      expect(result).toBe(`"command": "${CODEX_TOKEN}/hooks/update.js"`);
    });

    it("preserves path separator after token", () => {
      const content = `${CLAUDE_TOKEN}/hooks/run.sh`;
      const result = rewritePluginRootToken(content, CODEX_TOKEN);
      expect(result).toContain(`${CODEX_TOKEN}/hooks/`);
    });
  });

  describe("copilot substitution", () => {
    it("rewrites the claude token to the copilot native token", () => {
      const content = `"command": "${CLAUDE_TOKEN}/hooks/check.sh"`;
      const result = rewritePluginRootToken(content, COPILOT_TOKEN);
      expect(result).toBe(`"command": "${COPILOT_TOKEN}/hooks/check.sh"`);
    });

    it("preserves path separator after token", () => {
      const content = `${CLAUDE_TOKEN}/bin/server.js`;
      const result = rewritePluginRootToken(content, COPILOT_TOKEN);
      expect(result).toContain(`${COPILOT_TOKEN}/bin/`);
    });
  });

  describe("scope guard - other env variables are untouched", () => {
    it("leaves ISSUE_NUMBER unchanged", () => {
      const issueVar = "$" + "{ISSUE_NUMBER}";
      const content = `${CLAUDE_TOKEN}/hooks/check.sh ${issueVar}`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).toContain(issueVar);
    });

    it("leaves CLAUDE_SESSION_ID unchanged", () => {
      const sessionVar = "$" + "{CLAUDE_SESSION_ID}";
      const content = `${CLAUDE_TOKEN}/hooks/a.sh ${sessionVar}`;
      const result = rewritePluginRootToken(content, CURSOR_TOKEN);
      expect(result).toContain(sessionVar);
    });

    it("leaves RUNNER_TEMP unchanged", () => {
      const runnerVar = "$" + "{RUNNER_TEMP}";
      const content = `${CLAUDE_TOKEN}/hooks/a.sh ${runnerVar}`;
      const result = rewritePluginRootToken(content, CODEX_TOKEN);
      expect(result).toContain(runnerVar);
    });

    it("leaves CLAUDE_EFFORT unchanged", () => {
      const effortVar = "$" + "{CLAUDE_EFFORT}";
      const content = `${CLAUDE_TOKEN}/hooks/a.sh ${effortVar}`;
      const result = rewritePluginRootToken(content, COPILOT_TOKEN);
      expect(result).toContain(effortVar);
    });
  });

  describe("content without the source token", () => {
    it("returns content unchanged when token is absent", () => {
      const content = '{"command": "node ./hooks/update.js"}';
      expect(rewritePluginRootToken(content, CURSOR_TOKEN)).toBe(content);
    });

    it("returns empty string unchanged", () => {
      expect(rewritePluginRootToken("", CURSOR_TOKEN)).toBe("");
    });
  });

  describe("SOURCE_PLUGIN_ROOT_TOKEN constant", () => {
    it("exported constant matches the canonical source token", () => {
      expect(SOURCE_PLUGIN_ROOT_TOKEN).toBe(CLAUDE_TOKEN);
    });
  });
});

describe("per-tool pluginRootToken contract values", () => {
  it("claude contract uses the claude native token", () => {
    expect(buildContractOf(TOOL.claude, "marketplace").pluginRootToken).toBe(CLAUDE_TOKEN);
  });

  it("cursor contract uses the cursor native token", () => {
    expect(buildContractOf(TOOL.cursor, "marketplace").pluginRootToken).toBe(CURSOR_TOKEN);
  });

  it("codex contract uses the codex native token", () => {
    expect(buildContractOf(TOOL.codex, "marketplace").pluginRootToken).toBe(CODEX_TOKEN);
  });

  it("copilot marketplace contract uses the OpenPlugin native token", () => {
    expect(buildContractOf(TOOL.copilot, "marketplace").pluginRootToken).toBe(CODEX_TOKEN);
  });

  it("flat contracts do not set pluginRootToken", () => {
    for (const tool of [TOOL.claude, TOOL.cursor, TOOL.copilot, TOOL.codex]) {
      expect(buildContractOf(tool, "flat").pluginRootToken).toBeUndefined();
    }
  });
});

describe("the route that builds a marketplace bundle", () => {
  it("leaves a command alone for the tool whose variable is the one authors write", () => {
    const native = nativeOf(registeredAiConfig(TOOL.claude).plugins());
    const authored = `node ${native.rootToken()}/hooks/journal.cjs`;

    const token = buildContractOf(TOOL.claude, "marketplace").pluginRootToken;

    expect(rewritePluginRootToken(authored, token ?? "")).toBe(authored);
  });
});
