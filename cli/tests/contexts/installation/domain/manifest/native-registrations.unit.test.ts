import { describe, expect, it } from "vitest";
import {
  type NativeRegistrations,
  parseNativeRegistrations,
  serializeNativeRegistrations,
} from "../../../../../src/contexts/installation/domain/manifest/native-registrations.js";
import { InvalidManifestDataError } from "../../../../../src/shared/domain/errors.js";

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

  it("writes the host data first and the claims last", () => {
    const written = serializeNativeRegistrations({ pluginClaims: claims, binary: "claude" });

    expect(Object.keys(written)).toStrictEqual(["binary", "pluginClaims"]);
  });

  it("keeps an absent registration absent", () => {
    expect(parseNativeRegistrations(undefined)).toBeUndefined();
  });

  it.each([
    ["not an object", "claude"],
    ["claims that are not a list", { pluginClaims: "plugin@declared" }],
    ["a claim without a ref", { pluginClaims: [{ dependents: [] }] }],
    ["a claim whose dependents are not paths", { pluginClaims: [{ ref: "a@b", dependents: [1] }] }],
  ])("refuses %s", (_name, data) => {
    expect(() => parseNativeRegistrations(data)).toThrow(InvalidManifestDataError);
  });

  it.each(["serialize", "parse"] as const)(
    "%s produces an independent claim snapshot",
    (action) => {
      const dependents = ["/project-a", "/project-b"];
      const pluginClaims = [{ ref: "plugin@declared", dependents }];
      const input = { binary: "claude", pluginClaims };
      const expected = structuredClone(input);
      const snapshot =
        action === "serialize"
          ? serializeNativeRegistrations(input)
          : parseNativeRegistrations(input);

      pluginClaims[0] = { ref: "changed@declared", dependents: [] };
      dependents.push("/project-c");

      expect(snapshot).toStrictEqual(expected);
    }
  );
});
