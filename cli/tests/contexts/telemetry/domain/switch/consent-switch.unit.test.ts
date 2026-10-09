import { describe, expect, it } from "vitest";
import {
  switchedOff,
  switchedOn,
} from "../../../../../src/contexts/telemetry/domain/switch/consent-switch.js";

const parsed = (result: ReturnType<typeof switchedOn>) =>
  JSON.parse(result.status === "switched" ? result.text : "null");

describe("switching measurement on", () => {
  it("grants this version in a project that has no config", () => {
    expect(parsed(switchedOn(null))).toEqual({ telemetry: { enabled: true, version: 2 } });
  });

  it("keeps every other key, the telemetry key's own included", () => {
    const result = switchedOn(
      JSON.stringify({ keep: { a: 1 }, telemetry: { enabled: true, endpoint: "x" } })
    );
    expect(parsed(result)).toEqual({
      keep: { a: 1 },
      telemetry: { enabled: true, endpoint: "x", version: 2 },
    });
  });

  it("turns a bare enabled from the previous version into this version's consent", () => {
    expect(parsed(switchedOn('{"telemetry":{"enabled":true}}')).telemetry.version).toBe(2);
  });

  it("leaves a file that already grants this version alone", () => {
    expect(switchedOn('{"telemetry":{"enabled":true,"version":2}}')).toEqual({
      status: "unchanged",
    });
  });

  it("re-grants a switched-off project", () => {
    expect(parsed(switchedOn('{"telemetry":{"enabled":false,"version":2}}')).telemetry).toEqual({
      enabled: true,
      version: 2,
    });
  });

  it.each(["{not json", "[]", "3"])("never rewrites %s", (text) => {
    expect(switchedOn(text)).toEqual({ status: "unreadable" });
  });
});

describe("switching measurement off", () => {
  it("sets enabled to false and keeps the version and every other key", () => {
    const result = switchedOff(
      JSON.stringify({ keep: 1, telemetry: { enabled: true, version: 2 } })
    );
    expect(parsed(result)).toEqual({ keep: 1, telemetry: { enabled: false, version: 2 } });
  });

  it("has nothing to write in a project that has no config", () => {
    expect(switchedOff(null)).toEqual({ status: "unchanged" });
  });

  it("has nothing to write when there is no telemetry key, or it is already off", () => {
    expect(switchedOff('{"a":1}')).toEqual({ status: "unchanged" });
    expect(switchedOff('{"telemetry":{"enabled":false,"version":2}}')).toEqual({
      status: "unchanged",
    });
  });

  it("never rewrites a config that does not parse", () => {
    expect(switchedOff("{nope")).toEqual({ status: "unreadable" });
  });
});
