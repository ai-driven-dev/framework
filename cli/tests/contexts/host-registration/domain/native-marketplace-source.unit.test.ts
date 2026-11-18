import { describe, expect, it } from "vitest";
import {
  type NativeMarketplaceSource,
  readMarketplaceRegistration,
  sameNativeMarketplaceSource,
} from "../../../../src/contexts/host-registration/domain/native-marketplace-source.js";

const registry = (source: string): NativeMarketplaceSource => ({ kind: "registry", source });

const effectiveList = (
  overrides: Partial<Extract<NativeMarketplaceSource, { kind: "effective-list" }>> = {}
): NativeMarketplaceSource => ({
  kind: "effective-list",
  root: "/home/dev/.agents",
  sourceType: "git",
  source: "github.com/acme/market",
  ...overrides,
});

describe("when two readings name the same marketplace source", () => {
  it.each<[string, NativeMarketplaceSource, NativeMarketplaceSource, boolean]>([
    ["two registries naming one source", registry("acme/market"), registry("acme/market"), true],
    [
      "two registries naming different sources",
      registry("acme/market"),
      registry("acme/other"),
      false,
    ],
    [
      "a registry and an effective list naming one source",
      registry("github.com/acme/market"),
      effectiveList(),
      false,
    ],
    ["two identical effective lists", effectiveList(), effectiveList(), true],
    [
      "effective lists rooted differently",
      effectiveList(),
      effectiveList({ root: "/srv/.agents" }),
      false,
    ],
    [
      "effective lists of a different source type",
      effectiveList(),
      effectiveList({ sourceType: "local" }),
      false,
    ],
    [
      "effective lists naming different sources",
      effectiveList(),
      effectiveList({ source: "github.com/acme/other" }),
      false,
    ],
  ])("compares %s", (_case, recorded, current, same) => {
    expect(sameNativeMarketplaceSource(recorded, current)).toBe(same);
  });

  it("ignores a stray root a recorded registry carries", () => {
    const recorded = { kind: "registry", source: "acme/market", root: "/old" } as const;

    expect(sameNativeMarketplaceSource(recorded, registry("acme/market"))).toBe(true);
  });
});

describe("when a recorded marketplace registration is read", () => {
  it("keeps a registry source without requiring an effective-list root", () => {
    const entry = {
      alias: "local",
      hostName: "declared",
      provenance: { kind: "registry", source: "/built" },
    };

    expect(readMarketplaceRegistration(entry)).toStrictEqual(entry);
  });

  it.each([
    ["null", null],
    ["scalar", "registry"],
    ["unknown kind", { kind: "unknown", source: "/built" }],
    [
      "unknown kind with effective-list fields",
      { kind: "unknown", source: "/built", root: "/host", sourceType: "local" },
    ],
    ["missing source", { kind: "registry" }],
    ["empty source", { kind: "registry", source: "" }],
    ["non-string source", { kind: "registry", source: 1 }],
    ["missing root", { kind: "effective-list", source: "/built", sourceType: "local" }],
    ["empty root", { kind: "effective-list", source: "/built", sourceType: "local", root: "" }],
    ["non-string root", { kind: "effective-list", source: "/built", sourceType: "local", root: 1 }],
    ["missing source type", { kind: "effective-list", source: "/built", root: "/host" }],
    [
      "empty source type",
      { kind: "effective-list", source: "/built", root: "/host", sourceType: "" },
    ],
    [
      "non-string source type",
      { kind: "effective-list", source: "/built", root: "/host", sourceType: 1 },
    ],
  ])("leaves %s provenance unproven without dropping the registration", (_name, provenance) => {
    // A persisted manifest is JSON: its provenance may not satisfy the declared type.
    expect(
      readMarketplaceRegistration({ alias: "local", hostName: "declared", provenance })
    ).toStrictEqual({
      alias: "local",
      hostName: "declared",
    });
  });

  it.each([
    ["no alias", { hostName: "declared" }],
    ["no host name", { alias: "local" }],
    ["a scalar", "local"],
  ])("reads no registration from %s", (_name, entry) => {
    expect(readMarketplaceRegistration(entry)).toBeUndefined();
  });
});
