import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { inMarketplace, installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

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

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(claude, UNNAMED_AGENT)).toBe(`---
name: 'planner'
description: 'Plans the work'
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

    it.each(["true", "false"])(
      "preserves omitClaudeMd: %s through install and marketplace builds",
      (value) => {
        const source = NAMED_AGENT.replace("effort: high", `effort: high\nomitClaudeMd: ${value}`);
        const expected = installed(claude, source);

        expect(expected).toContain(`omitClaudeMd: ${value}`);
        expect(inMarketplace(claude, source).content).toBe(expected);
      }
    );

    it("leaves omitClaudeMd absent when the source does not set it", () => {
      expect(installed(claude, NAMED_AGENT)).not.toContain("omitClaudeMd");
      expect(inMarketplace(claude, NAMED_AGENT).content).not.toContain("omitClaudeMd");
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path for agents section", () => {
      const path = claude.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });
});
