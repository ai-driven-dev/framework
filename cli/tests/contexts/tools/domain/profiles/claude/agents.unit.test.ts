import { describe, expect, it } from "vitest";
import { AgentsCapability } from "../../../../../../src/contexts/tools/domain/capabilities/agents-capability.js";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
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
      const markdown = new AgentsCapability({
        ...claude.capabilities.agents.params,
        format: "markdown",
      });

      expect(claude.capabilities.agents.equals(markdown)).toBe(true);
    });
  });
});
