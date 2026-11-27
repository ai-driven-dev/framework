import { describe, expect, it } from "vitest";
import { toolWarning } from "../../../../src/shared/domain/plugin/plugin-translation-skip.js";

describe("the warning of a route, under its tool", () => {
  it("leads with the tool's name", () => {
    expect(toolWarning("cursor", "unmapped event 'Notification' skipped")).toBe(
      "cursor: unmapped event 'Notification' skipped"
    );
  });
});
