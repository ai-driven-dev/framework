import { describe, expect, it } from "vitest";
import { copilot } from "../../../../../../src/contexts/tools/domain/profiles/copilot/profile.js";
import { inMarketplace, installed, NAMED_AGENT } from "../../../testing/agent-fixture.js";

const NATIVE = `---
name: 'planner'
description: 'Plans the work'
model: 'm'
reasoningEffort: 'high'
include-custom-instructions: true
---
Plan before building.
`;

describe("copilot agents", () => {
  describe("name resolution", () => {
    it("installs a plugin agent under its declared name, with the repository instructions", () => {
      expect(installed(copilot, NAMED_AGENT)).toBe(NATIVE);
    });

    it("keeps the declared name inside the plugin of a marketplace build", () => {
      expect(inMarketplace(copilot, NAMED_AGENT)).toStrictEqual({
        path: "agents/planner.md",
        content: NATIVE,
      });
    });
  });

  it("keeps an explicit opt-out of the repository instructions", () => {
    expect(
      copilot.section("agents").convertFrontmatter({
        name: "reviewer",
        "include-custom-instructions": false,
      })
    ).toHaveProperty("include-custom-instructions", false);
  });
});
