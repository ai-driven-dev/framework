import { describe, expect, it } from "vitest";
import { cursor } from "../../../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { inMarketplace, installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

const PREFIXED = `---
name: "aidd-dev-planner"
description: "Plans the work"
model: "m[effort=high]"
---
Plan before building.
`;

describe("cursor agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, double-quoted, effort inside the model", () => {
      expect(installed(cursor, NAMED_AGENT)).toBe(`---
name: "planner"
description: "Plans the work"
model: "m[effort=high]"
---
Plan before building.
`);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(cursor, UNNAMED_AGENT)).toBe(`---
name: "planner"
description: "Plans the work"
---
Plan before building.
`);
    });

    it("prefixes the name with the plugin in a marketplace build", () => {
      expect(inMarketplace(cursor, NAMED_AGENT)).toStrictEqual({
        path: "agents/planner.md",
        content: PREFIXED,
      });
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("keeps .md extension for agents", () => {
      const path = cursor.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".cursor/agents/code-reviewer.md");
    });
  });
});
