import { describe, expect, it } from "vitest";
import { kiro } from "../../../../../../src/contexts/tools/domain/profiles/kiro/profile.js";
import { installed, NAMED_AGENT, UNNAMED_AGENT } from "../agent-fixture.js";

const NATIVE = `{
  "name": "planner",
  "description": "Plans the work",
  "prompt": "Plan before building.",
  "tools": [
    "*"
  ]
}
`;

describe("kiro agents", () => {
  describe("name resolution", () => {
    it("writes a JSON profile named after the agent, with no model, effort or 2.x key", () => {
      expect(installed(kiro, NAMED_AGENT)).toBe(NATIVE);
    });

    it("names an unnamed plugin agent after its file", () => {
      expect(installed(kiro, UNNAMED_AGENT)).toBe(NATIVE);
    });
  });

  describe("install path", () => {
    it("writes the profile as JSON under .kiro/agents/, its Kiro suffix dropped", () => {
      expect(kiro.capabilities.agents.buildInstallPath("agents/planner.kiro.md")).toBe(
        ".kiro/agents/planner.json"
      );
    });

    it("writes a plain markdown source as JSON too", () => {
      expect(kiro.capabilities.agents.buildInstallPath("planner.md")).toBe(
        ".kiro/agents/planner.json"
      );
    });

    it("keeps the file name alone from a nested source path", () => {
      expect(kiro.capabilities.agents.buildInstallPath("agents/review/planner.md")).toBe(
        ".kiro/agents/planner.json"
      );
    });
  });
});
