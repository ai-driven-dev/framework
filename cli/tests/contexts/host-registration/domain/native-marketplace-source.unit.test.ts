import { describe, expect, it } from "vitest";
import {
  type NativeMarketplaceSource,
  sameNativeMarketplaceSource,
} from "../../../../src/contexts/host-registration/contract/host-marketplace-sources.js";

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
