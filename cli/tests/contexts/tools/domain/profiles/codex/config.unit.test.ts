import { describe, expect, it } from "vitest";
import { mergeCodexConfigToml } from "../../../../../../src/contexts/tools/domain/profiles/codex/build.js";

const MCP_PAYLOAD = `
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@anthropic-ai/mcp-playwright"]
`;

describe("mergeCodexConfigToml", () => {
  it("writes full payload into empty file", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).toContain("mcp_servers");
    expect(result).toContain("playwright");
    expect(result).toContain("project_doc_max_bytes = 262144");
    expect(result).toContain("hooks = true");
  });

  it("preserves user keys not managed by AIDD", () => {
    const existing = `
[user_section]
custom_key = "user value"
`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain('custom_key = "user value"');
    expect(result).toContain("playwright");
  });

  it("is idempotent on second run", () => {
    const first = mergeCodexConfigToml("", MCP_PAYLOAD);
    const second = mergeCodexConfigToml(first, MCP_PAYLOAD);
    expect(second).toContain("playwright");
    const mcpCount = (second.match(/\[mcp_servers\.playwright\]/g) ?? []).length;
    expect(mcpCount).toBe(1);
  });

  it("existing MCP server wins on conflict (user-prime)", () => {
    const existing = `
[mcp_servers.playwright]
command = "user-command"
`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain('command = "user-command"');
    expect(result).not.toContain('"npx"');
  });

  it("preserves user project_doc_max_bytes when above minimum", () => {
    const existing = `project_doc_max_bytes = 999999`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain("project_doc_max_bytes = 999999");
    expect(result).not.toContain("262144");
  });

  it("sets minimum project_doc_max_bytes when absent", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).toContain("project_doc_max_bytes = 262144");
  });

  it("ensures hooks feature when absent", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).toContain("hooks = true");
  });

  it("preserves user codex_hooks value when already set", () => {
    const existing = `
[features]
codex_hooks = false
`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain("codex_hooks = false");
    expect(result).not.toContain("hooks = true");
  });

  it("does NOT emit [[skills.config]] — discovery is by placement", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).not.toContain(".agents/skills");
    expect(result).not.toContain("skills.config");
  });

  it("preserves existing skills.config if user has one", () => {
    const existing = `
[skills.config]
path = ".agents/skills"
enabled = true
`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain(".agents/skills");
  });

  it("starts over from a config it cannot parse rather than failing the install", () => {
    expect(mergeCodexConfigToml("not = [valid", '[mcp_servers.ctx]\ncommand = "node"\n')).toBe(
      'project_doc_max_bytes = 262144\n\n[mcp_servers.ctx]\ncommand = "node"\n\n[features]\nhooks = true\n'
    );
  });

  it("adds only its defaults when the payload names no mcp server", () => {
    expect(mergeCodexConfigToml('[mcp_servers.mine]\ncommand = "x"\n', "")).toBe(
      'project_doc_max_bytes = 262144\n\n[mcp_servers.mine]\ncommand = "x"\n\n[features]\nhooks = true\n'
    );
  });

  it("raises project_doc_max_bytes to what the payload asks when that is above the floor", () => {
    expect(mergeCodexConfigToml("", "project_doc_max_bytes = 500000\n")).toBe(
      "project_doc_max_bytes = 500000\n\n[features]\nhooks = true\n"
    );
  });

  it("leaves a user's project_doc_max_bytes already at the floor untouched, whatever the payload asks", () => {
    expect(
      mergeCodexConfigToml("project_doc_max_bytes = 262144\n", "project_doc_max_bytes = 500000\n")
    ).toBe("project_doc_max_bytes = 262144\n\n[features]\nhooks = true\n");
  });

  it("keeps a user's own hooks = false rather than turning hooks on", () => {
    expect(mergeCodexConfigToml("[features]\nhooks = false\n", "")).toBe(
      "project_doc_max_bytes = 262144\n\n[features]\nhooks = false\n"
    );
  });

  it("turns hooks on beside a user's other features, keeping them", () => {
    expect(mergeCodexConfigToml("[features]\nweb_search = true\n", "")).toBe(
      "project_doc_max_bytes = 262144\n\n[features]\nweb_search = true\nhooks = true\n"
    );
  });
});
