import { describe, expect, it } from "vitest";
import { claude } from "../../../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { built, installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

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
      expect(built(claude, "marketplace", NAMED_AGENT)).toStrictEqual({
        path: "agents/planner.md",
        content: installed(claude, NAMED_AGENT),
      });
    });

    it("prefixes the name with the plugin in a flat build, which shares one agents directory", () => {
      expect(built(claude, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".claude/agents/aidd-dev-planner.md",
        content: `---
name: 'aidd-dev-planner'
description: 'Plans the work'
model: 'm'
effort: 'high'
---
Plan before building.
`,
      });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path for agents section", () => {
      const path = claude.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".claude/agents/code-reviewer.md");
    });
  });
});
