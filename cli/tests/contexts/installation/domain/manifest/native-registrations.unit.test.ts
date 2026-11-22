import { describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../../src/contexts/installation/domain/installation.error.js";
import {
  type NativeRegistrations,
  parseNativeRegistrations,
  serializeNativeRegistrations,
} from "../../../../../src/contexts/installation/domain/manifest/native-registrations.js";

const claims = [{ ref: "plugin@declared", dependents: ["/project-a"] }];

describe("native registrations: what the manifest keeps of a tool's host registration", () => {
  it("round-trips the host record as it came and the claims beside it", () => {
    const stored: NativeRegistrations = {
      binary: "claude",
      marketplaces: [{ alias: "local", hostName: "declared" }],
      pluginRefs: ["plugin@declared"],
      pluginClaims: claims,
    };

    expect(parseNativeRegistrations(serializeNativeRegistrations(stored))).toStrictEqual(stored);
  });

  it("holds the host record opaque, whatever it carries", () => {
    const stored = { somethingTheHostAdded: { nested: [1] }, binary: 7 };

    expect(parseNativeRegistrations(stored)).toStrictEqual(stored);
    expect(serializeNativeRegistrations(stored)).toStrictEqual(stored);
  });

  it("keeps the keys in the order they came", () => {
    const written = serializeNativeRegistrations({ binary: "claude", pluginClaims: claims });

    expect(Object.keys(written)).toStrictEqual(["binary", "pluginClaims"]);
  });

  it("keeps an absent registration absent", () => {
    expect(parseNativeRegistrations(undefined)).toBeUndefined();
  });

  it("refuses a record that is not an object", () => {
    expect(() => parseNativeRegistrations("claude")).toThrow(InvalidManifestDataError);
  });

  it.each(["serialize", "parse"] as const)("%s copies the top level only", (action) => {
    const input: Record<string, unknown> = { binary: "claude", pluginClaims: claims };
    const copy =
      action === "serialize"
        ? serializeNativeRegistrations(input)
        : parseNativeRegistrations(input);

    input.binary = "changed";

    expect(copy?.binary).toBe("claude");
  });
});
