import { describe, expect, it } from "vitest";
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

  it("keeps an absent registration absent", () => {
    expect(parseNativeRegistrations(undefined)).toBeUndefined();
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
