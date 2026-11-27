import { describe, expect, it } from "vitest";
import { catalogVersionRequirement } from "../../../../src/contexts/distribution/contract/requested-version-policy.js";
import { VersionMismatchError } from "../../../../src/shared/domain/shared.error.js";

const entry = (version?: string) => ({ name: "alpha", version });

describe("holding a requested version against the catalog entry's", () => {
  it("passes the requested version when it matches the catalog", () => {
    expect(catalogVersionRequirement(entry("1.0.0"), "1.0.0", "strict")).toEqual({
      requiredVersion: "1.0.0",
      overridden: false,
    });
  });

  it("passes the requested version when the catalog states none", () => {
    expect(catalogVersionRequirement(entry(undefined), "1.0.0", "strict")).toEqual({
      requiredVersion: "1.0.0",
      overridden: false,
    });
  });

  it("requires nothing when no version was requested", () => {
    expect(catalogVersionRequirement(entry("1.0.0"), undefined, "strict")).toEqual({
      requiredVersion: undefined,
      overridden: false,
    });
  });

  it("refuses a requested version the catalog differs from under the strict policy", () => {
    expect(() => catalogVersionRequirement(entry("1.0.0"), "2.0.0", "strict")).toThrow(
      VersionMismatchError
    );
  });

  it("drops the requested version and flags it when the catalog differs and prefers itself", () => {
    expect(catalogVersionRequirement(entry("1.0.0"), "2.0.0", "prefer-catalog")).toEqual({
      requiredVersion: undefined,
      overridden: true,
    });
  });

  it("drops the requested version without a flag when the catalog agrees", () => {
    expect(catalogVersionRequirement(entry("1.0.0"), "1.0.0", "prefer-catalog")).toEqual({
      requiredVersion: undefined,
      overridden: false,
    });
  });

  it("flags nothing when the catalog states no version under prefer-catalog", () => {
    expect(catalogVersionRequirement(entry(undefined), "2.0.0", "prefer-catalog").overridden).toBe(
      false
    );
  });
});
