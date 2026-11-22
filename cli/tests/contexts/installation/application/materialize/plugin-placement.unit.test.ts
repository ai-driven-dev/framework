import { describe, expect, it } from "vitest";
import { placementModeOf } from "../../../../../src/contexts/installation/application/materialize/plugin-placement.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";

describe("placementModeOf", () => {
  it("answers nothing for a tool that is not an AI tool", () => {
    expect(placementModeOf(registeredTools().profile(TOOL.vscode))).toBeNull();
  });

  it("registers a marketplace reference for a tool whose plugins do not materialize from the built tree", () => {
    expect(placementModeOf(registeredTools().aiProfile(TOOL.claude))).toBe("marketplace");
  });

  it("copies the built tree for a tool whose plugins materialize from it", () => {
    expect(placementModeOf(registeredTools().aiProfile(TOOL.cursor))).toBe("built-tree");
  });
});
