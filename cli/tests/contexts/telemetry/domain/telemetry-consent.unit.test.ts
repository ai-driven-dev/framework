import { describe, expect, it } from "vitest";
import { consentOf } from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";

const value = (text: string | null) => ({ kind: "value", value: text }) as const;

describe("a clone's consent", () => {
  it("is granted by exactly 2", () => {
    expect(consentOf(value("2"))).toBe("granted");
  });

  it.each([["off"], ["1"], ["3"], ["02"], [" 2"], ["2 "], ["true"], [""], ["two"]])(
    "is not granted by %j",
    (text) => {
      expect(consentOf(value(text))).toBe("absent");
    }
  );

  it("is absent when the key is not set", () => {
    expect(consentOf(value(null))).toBe("absent");
  });

  it("is unreadable, not absent, when git could not answer", () => {
    expect(consentOf({ kind: "unreadable" })).toBe("unreadable");
  });
});
