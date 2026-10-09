import { describe, expect, it } from "vitest";
import { consentOf } from "../../../../src/contexts/telemetry/domain/telemetry-consent.js";

const config = (telemetry: unknown): string => JSON.stringify({ other: 1, telemetry });

describe("a project's consent", () => {
  it("is granted by enabled true with version 2", () => {
    expect(consentOf(config({ enabled: true, version: 2 }))).toBe("granted");
  });

  it("is not granted by the previous version's bare enabled true", () => {
    expect(consentOf(config({ enabled: true }))).toBe("absent");
  });

  it.each([
    ["version 1", { enabled: true, version: 1 }],
    ["version 3", { enabled: true, version: 3 }],
    ["a string version", { enabled: true, version: "2" }],
    ["enabled false", { enabled: false, version: 2 }],
    ["enabled as a string", { enabled: "true", version: 2 }],
    ["no enabled", { version: 2 }],
    ["a non-object telemetry", true],
  ])("is not granted by %s", (_name, telemetry) => {
    expect(consentOf(config(telemetry))).toBe("absent");
  });

  it("is absent when there is no config file or no telemetry key", () => {
    expect(consentOf(null)).toBe("absent");
    expect(consentOf("{}")).toBe("absent");
  });

  it.each([["{not json"], [""], ["[]"], ["null"], ["42"]])(
    "is unreadable, not absent, for %j",
    (text) => {
      expect(consentOf(text)).toBe("unreadable");
    }
  );
});
