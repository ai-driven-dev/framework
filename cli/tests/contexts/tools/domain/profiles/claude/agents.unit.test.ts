import { describe, expect, it } from "vitest";
import { claudeAgentFrontmatter } from "../../../../../../src/contexts/tools/domain/profiles/claude/claude-agent.js";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { AgentsSection } from "../../../../../../src/contexts/tools/domain/sections/agents-section.js";
import { inMarketplace, installed, NAMED_AGENT } from "../../../testing/agent-fixture.js";

describe("claude agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, with Claude's own keys only", () => {
      expect(installed(claude, NAMED_AGENT)).toBe(`---
name: 'planner'
description: 'Plans the work'
model: 'm'
effort: 'high'
---
Plan before building.
`);
    });

    it("keeps the declared name inside the plugin of a marketplace build", () => {
      expect(inMarketplace(claude, NAMED_AGENT)).toStrictEqual({
        path: "agents/planner.md",
        content: installed(claude, NAMED_AGENT),
      });
    });
  });

  describe("format", () => {
    it("writes markdown, the same as a capability declared with that format", () => {
      const markdown = new AgentsSection({
        directory: claude.directory,
        toolSuffix: claude.toolSuffix,
        format: "markdown",
        frontmatter: claudeAgentFrontmatter,
      });

      expect(claude.section("agents").equals(markdown)).toBe(true);
    });
  });
});
