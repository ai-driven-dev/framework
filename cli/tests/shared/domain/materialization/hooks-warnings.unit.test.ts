import { describe, expect, it } from "vitest";
import { unmappedEventWarning } from "../../../../src/shared/domain/materialization/hooks-warnings.js";

describe("the warning of an event no tool fires", () => {
  it("names the event and says it was skipped", () => {
    expect(unmappedEventWarning("SessionEnd")).toBe("unmapped event 'SessionEnd' skipped");
  });
});
