import { describe, expect, it } from "vitest";
import { compareSemver, isSemver } from "../../src/kernel/semver.js";

describe("isSemver(), component width", () => {
  it("accepts a multi-digit major", () => {
    expect(isSemver("10.0.0")).toBe(true);
  });

  it("accepts a multi-digit patch", () => {
    expect(isSemver("1.0.10")).toBe(true);
  });
});

describe("compareSemver(), release components", () => {
  it("orders by patch when major and minor agree", () => {
    expect([compareSemver("1.0.1", "1.0.2"), compareSemver("1.0.2", "1.0.1")]).toStrictEqual([
      -1, 1,
    ]);
  });

  it("reads an unparseable version as 0.0.0", () => {
    expect(compareSemver("garbage", "0.0.0")).toBe(0);
  });
});

describe("compareSemver(), pre-release identifiers", () => {
  it("is 0 for two identical pre-release versions", () => {
    expect(compareSemver("1.0.0-rc.1", "1.0.0-rc.1")).toBe(0);
  });

  it("orders numeric identifiers numerically in both directions", () => {
    expect(compareSemver("1.0.0-rc.10", "1.0.0-rc.2")).toBe(1);
  });

  it("orders lexical identifiers in both directions", () => {
    expect(compareSemver("1.0.0-beta", "1.0.0-alpha")).toBe(1);
  });

  it("orders a numeric identifier below a non-numeric one", () => {
    expect([
      compareSemver("1.0.0-1", "1.0.0-alpha"),
      compareSemver("1.0.0-alpha", "1.0.0-1"),
    ]).toStrictEqual([-1, 1]);
  });

  it("orders a numeric identifier below a non-numeric one that sorts first as text", () => {
    expect(compareSemver("1.0.0--x", "1.0.0-1")).toBe(1);
  });

  it("reads an identifier as numeric only when it is digits throughout", () => {
    expect([
      compareSemver("1.0.0-alpha1", "1.0.0-alpha2"),
      compareSemver("1.0.0-1a", "1.0.0-1b"),
    ]).toStrictEqual([-1, -1]);
  });

  it("compares multi-digit identifiers by value, not by their first digit", () => {
    expect(compareSemver("1.0.0-rc.20", "1.0.0-rc.100")).toBe(-1);
  });

  it("orders the shorter list below on a shared prefix", () => {
    expect([
      compareSemver("1.0.0-rc", "1.0.0-rc.1"),
      compareSemver("1.0.0-rc.1", "1.0.0-rc"),
    ]).toStrictEqual([-1, 1]);
  });
});
