import { describe, expect, it } from "vitest";
import {
  consentOf,
  consentValue,
  tokenOfKey,
  turnedOff,
} from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";

const value = (text: string | null) => ({ kind: "value", value: text }) as const;

describe("a clone's consent", () => {
  it("is granted by 2: and a token, and the key names that token", () => {
    expect(consentOf(value("2:abc-123"))).toBe("granted");
    expect(tokenOfKey("2:abc-123")).toBe("abc-123");
    expect(tokenOfKey(consentValue("t"))).toBe("t");
  });

  it.each([
    ["2"],
    ["2:"],
    ["2: t"],
    ["2:t "],
    ["off"],
    ["1"],
    ["3:t"],
    ["02:t"],
    [" 2:t"],
    ["true"],
    [""],
    ["two"],
  ])("is not granted by %j", (text) => {
    expect(consentOf(value(text))).toBe("absent");
    expect(tokenOfKey(text)).toBeNull();
  });

  it("is absent when the key is not set", () => {
    expect(consentOf(value(null))).toBe("absent");
    expect(tokenOfKey(null)).toBeNull();
  });

  it("is unreadable, not absent, when git could not answer", () => {
    expect(consentOf({ kind: "unreadable" })).toBe("unreadable");
  });
});

describe("a clone turned off", () => {
  it("is one whose key is off, as `aidd telemetry off` writes it", () => {
    expect(turnedOff(value("off"))).toBe(true);
  });

  it.each([[null], ["2"], ["2:t"], ["true"], ["{}"], ["OFF"], [" off"], ["off "], [""]])(
    "is not one whose key is %j",
    (text) => {
      expect(turnedOff(value(text))).toBe(false);
    }
  );

  it("is not one whose git config cannot be read", () => {
    expect(turnedOff({ kind: "unreadable" })).toBe(false);
  });
});
