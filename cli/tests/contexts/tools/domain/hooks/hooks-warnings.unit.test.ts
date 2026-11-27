import { describe, expect, it } from "vitest";
import {
  toolWarning,
  unmappedEventWarning,
} from "../../../../../src/contexts/tools/domain/hooks/hooks-warnings.js";

describe("the warning of an event no tool fires", () => {
  it("names the event and says it was skipped", () => {
    expect(unmappedEventWarning("SessionEnd")).toBe("unmapped event 'SessionEnd' skipped");
  });
});

describe("the warning of a route, under its tool", () => {
  it("leads with the tool's name", () => {
    expect(toolWarning("cursor", unmappedEventWarning("Notification"))).toBe(
      "cursor: unmapped event 'Notification' skipped"
    );
  });
});
