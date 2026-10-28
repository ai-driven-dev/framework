import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { built, installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

const NATIVE = `---
description: 'Plans the work'
model: 'm'
variant: 'high'
mode: 'subagent'
---
Plan before building.
`;

describe("kilo agents", () => {
  describe("name resolution", () => {
    it("names a plugin agent after its file, so no name, and Claude's effort as its variant", () => {
      expect(installed(kilo, NAMED_AGENT)).toBe(NATIVE);
    });

    it("writes an unnamed plugin agent the same way", () => {
      expect(installed(kilo, UNNAMED_AGENT)).toBe(`---
description: 'Plans the work'
mode: 'subagent'
---
Plan before building.
`);
    });

    it("prefixes the file with the plugin in a flat build, which is the agent's name", () => {
      expect(built(kilo, "flat", NAMED_AGENT)).toStrictEqual({
        path: ".kilo/agents/aidd-dev-planner.md",
        content: NATIVE,
      });
    });
  });
});
