import { describe, expect, it } from "vitest";
import {
  codex,
  mergeCodexConfigToml,
  reverseRewriteCodexContent,
  rewriteCodexContent,
} from "../../../../src/domain/tools/ai/codex.js";
import { getToolConfig } from "../../../../src/domain/tools/registry.js";

describe("codex", () => {
  it("has toolId codex", () => {
    expect(codex.toolId).toBe("codex");
  });

  it("has .codex/ directory", () => {
    expect(codex.directory).toBe(".codex/");
  });

  it("has .codex.md tool suffix", () => {
    expect(codex.toolSuffix).toBe(".codex.md");
  });

  it("has no signalDir", () => {
    expect(codex.signalDir).toBeNull();
  });

  it("is registered in the tool registry", () => {
    const config = getToolConfig("codex");
    expect(config.toolId).toBe("codex");
  });

  describe("capabilities.skills.buildInstallPath()", () => {
    it("builds path under .agents/skills/aidd-{name}/SKILL.md", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill/SKILL.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("strips .codex.md tool suffix", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill.codex.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });

    it("strips plain .md suffix from skill name", () => {
      const path = codex.capabilities.skills.buildInstallPath("my-skill.md");
      expect(path).toBe(".agents/skills/aidd-my-skill/SKILL.md");
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds .toml path under .codex/agents/", () => {
      const path = codex.capabilities.agents.buildInstallPath("alexia.md");
      expect(path).toBe(".codex/agents/alexia.toml");
    });
  });

  describe("capabilities.mcp", () => {
    it("outputs to .codex/config.toml", () => {
      expect(codex.capabilities.mcp.params.outputPath).toBe(".codex/config.toml");
    });

    it("consumes the mcp config name", () => {
      expect(codex.capabilities.mcp.consumes).toContain("mcp");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.mcp.params.mergeStrategy ?? "user-prime").toBe("user-prime");
    });

    it("uses mcp_servers as entry section", () => {
      expect(codex.capabilities.mcp.params.entrySection).toBe("mcp_servers");
    });
  });

  describe("capabilities.hooks", () => {
    it("outputs to .codex/hooks.json", () => {
      expect(codex.capabilities.hooks.buildOutputPath()).toBe(".codex/hooks.json");
    });

    it("consumes the codex-hooks config name", () => {
      expect(codex.capabilities.hooks.consumes).toContain("codex-hooks");
    });

    it("uses user-prime merge strategy", () => {
      expect(codex.capabilities.hooks.getMergeStrategy()).toBe("user-prime");
    });

    it("uses SessionStart as entry section", () => {
      expect(codex.capabilities.hooks.getEntrySection()).toBe("SessionStart");
    });

    it("returns null entry section for unknown config names", () => {
      const cap = [codex.capabilities.mcp, codex.capabilities.hooks].find((c) =>
        c.consumes.includes("unknown")
      );
      expect(cap).toBeUndefined();
    });
  });

  describe("capabilities.memory.buildInstallPath()", () => {
    it("returns AGENTS.md for agentsMd template", () => {
      expect(codex.capabilities.memory.buildInstallPath("agentsMd")).toBe("AGENTS.md");
    });

    it("returns null for unknown template names", () => {
      expect(codex.capabilities.memory.buildInstallPath("unknown")).toBeNull();
    });
  });

  describe("detectUserFileSectionKey()", () => {
    it("detects agents section for .codex/agents/ paths", () => {
      const key = codex.detectUserFileSectionKey(".codex/agents/alexia.toml");
      expect(key).toEqual({ section: "agents", key: "alexia.toml" });
    });

    it("detects skills section for .agents/skills/aidd- paths", () => {
      const key = codex.detectUserFileSectionKey(".agents/skills/aidd-my-skill/SKILL.md");
      expect(key).toEqual({ section: "skills", key: "my-skill/SKILL.md" });
    });

    it("returns null for unrecognised paths", () => {
      expect(codex.detectUserFileSectionKey("AGENTS.md")).toBeNull();
      expect(codex.detectUserFileSectionKey("unknown.json")).toBeNull();
    });
  });
});

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
    expect(result).toContain("codex_hooks = true");
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

  it("ensures codex_hooks feature when absent", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).toContain("codex_hooks = true");
  });

  it("preserves user codex_hooks value when already set", () => {
    const existing = `
[features]
codex_hooks = false
`;
    const result = mergeCodexConfigToml(existing, MCP_PAYLOAD);
    expect(result).toContain("codex_hooks = false");
  });

  it("adds skills.config pointing to .agents/skills when absent", () => {
    const result = mergeCodexConfigToml("", MCP_PAYLOAD);
    expect(result).toContain(".agents/skills");
  });

  it("is idempotent for skills.config on second run", () => {
    const first = mergeCodexConfigToml("", MCP_PAYLOAD);
    const second = mergeCodexConfigToml(first, MCP_PAYLOAD);
    const count = (second.match(/\.agents\/skills/g) ?? []).length;
    expect(count).toBe(1);
  });
});
