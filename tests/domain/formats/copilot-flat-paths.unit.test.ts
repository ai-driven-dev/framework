import { describe, expect, it } from "vitest";
import {
  FLAT_MCP_OUTPUT_PATH,
  flatAgentPath,
  flatHooksFile,
  flatMcpKeyPrefix,
  flatSkillPath,
  resolveClaudeRootSuffixForFlat,
} from "../../../src/domain/formats/copilot-flat-paths.js";

describe("flatAgentPath", () => {
  it("strips .md suffix and adds .agent.md", () => {
    expect(flatAgentPath("aidd-dev", "implementer.md")).toBe(
      ".github/agents/aidd-dev/implementer.agent.md"
    );
  });

  it("does not double-strip when name has no .md", () => {
    expect(flatAgentPath("aidd-dev", "reviewer")).toBe(".github/agents/aidd-dev/reviewer.agent.md");
  });

  it("uses plugin name in path", () => {
    expect(flatAgentPath("my-plugin", "agent.md")).toBe(".github/agents/my-plugin/agent.agent.md");
  });
});

describe("flatSkillPath", () => {
  it("nests under .github/skills/<plugin>/", () => {
    expect(flatSkillPath("aidd-dev", "commit/SKILL.md")).toBe(
      ".github/skills/aidd-dev/commit/SKILL.md"
    );
  });

  it("preserves single-level rel path", () => {
    expect(flatSkillPath("aidd-dev", "hello.md")).toBe(".github/skills/aidd-dev/hello.md");
  });
});

describe("flatHooksFile", () => {
  it("returns per-plugin hooks file path", () => {
    expect(flatHooksFile("aidd-dev")).toBe(".github/hooks/aidd-dev.hooks.json");
  });

  it("uses the full plugin name", () => {
    expect(flatHooksFile("my-awesome-plugin")).toBe(".github/hooks/my-awesome-plugin.hooks.json");
  });
});

describe("flatMcpKeyPrefix", () => {
  it("returns plugin name with trailing dash", () => {
    expect(flatMcpKeyPrefix("aidd-dev")).toBe("aidd-dev-");
  });
});

describe("FLAT_MCP_OUTPUT_PATH", () => {
  it("points to workspace mcp.json", () => {
    expect(FLAT_MCP_OUTPUT_PATH).toBe(".vscode/mcp.json");
  });
});

describe("resolveClaudeRootSuffixForFlat", () => {
  describe("relative mode (hooks)", () => {
    it("rewrites agents/<X> to ./.github/agents/<plugin>/<X>.agent.md", () => {
      const result = resolveClaudeRootSuffixForFlat("agents/check.md", "aidd-test", "relative");
      expect(result).toBe("./.github/agents/aidd-test/check.agent.md");
    });

    it("handles agents/<X> without .md suffix", () => {
      const result = resolveClaudeRootSuffixForFlat("agents/check", "aidd-test", "relative");
      expect(result).toBe("./.github/agents/aidd-test/check.agent.md");
    });

    it("rewrites skills/<X> to ./.github/skills/<plugin>/<X>", () => {
      const result = resolveClaudeRootSuffixForFlat(
        "skills/commit/SKILL.md",
        "aidd-dev",
        "relative"
      );
      expect(result).toBe("./.github/skills/aidd-dev/commit/SKILL.md");
    });

    it("uses defensive default for unknown section", () => {
      const result = resolveClaudeRootSuffixForFlat("bin/server.js", "aidd-test", "relative");
      expect(result).toBe("./.github/bin/server.js");
    });
  });

  describe("absolute mode (MCP)", () => {
    it("rewrites agents/<X> to absOut/.github/agents/<plugin>/<X>.agent.md", () => {
      const result = resolveClaudeRootSuffixForFlat(
        "agents/check.md",
        "aidd-test",
        "absolute",
        "/project"
      );
      expect(result).toBe("/project/.github/agents/aidd-test/check.agent.md");
    });

    it("rewrites skills/<X> to absOut/.github/skills/<plugin>/<X>", () => {
      const result = resolveClaudeRootSuffixForFlat(
        "skills/commit/SKILL.md",
        "aidd-dev",
        "absolute",
        "/project"
      );
      expect(result).toBe("/project/.github/skills/aidd-dev/commit/SKILL.md");
    });

    it("throws when absOut is missing", () => {
      expect(() =>
        resolveClaudeRootSuffixForFlat("agents/check.md", "aidd-test", "absolute")
      ).toThrow("absOut is required");
    });
  });
});
