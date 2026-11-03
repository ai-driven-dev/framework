import { describe, expect, it } from "vitest";
import { opencode } from "../../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

const NATIVE = `---
description: 'Plans the work'
model: 'm#high'
mode: 'subagent'
---
Plan before building.
`;

describe("opencode agents", () => {
  describe("name resolution", () => {
    it("names a plugin agent after its file, so no name, effort as the model's variant", () => {
      expect(installed(opencode, NAMED_AGENT)).toBe(NATIVE);
    });

    it("writes an unnamed plugin agent the same way", () => {
      expect(installed(opencode, UNNAMED_AGENT)).toBe(`---
description: 'Plans the work'
mode: 'subagent'
---
Plan before building.
`);
    });
  });

  describe("capabilities.agents.buildInstallPath()", () => {
    it("builds path under .opencode/agents/", () => {
      const path = opencode.capabilities.agents.buildInstallPath("code-reviewer.md");
      expect(path).toBe(".opencode/agents/code-reviewer.md");
    });

    it("strips .opencode.md tool suffix", () => {
      const path = opencode.capabilities.agents.buildInstallPath("alexia.opencode.md");
      expect(path).toBe(".opencode/agents/alexia.md");
    });
  });
});
