import { describe, expect, it } from "vitest";
import { distributionProbesOf } from "../../../../src/contexts/translate/domain/plugin-format.js";
import { catalogOf } from "../../tools/testing/catalog-of.js";
import { aProfile } from "../../tools/testing/profiles.js";

describe("distributionProbesOf", () => {
  // Order is behaviour: the reader takes the first probe that resolves, and a bare
  // `plugin.json` at the root is satisfied by almost any directory.
  it("puts the deepest path first and a bare filename last", () => {
    const catalog = catalogOf([
      aProfile("claude").withManifestProbe(["plugin.json"]).build(),
      aProfile("copilot").withManifestProbe([".plugin/plugin.json", ".a/b/plugin.json"]).build(),
    ]);

    const probes = distributionProbesOf(catalog.sortedById(), "manifest");

    expect(probes.map((probe) => probe.relativePath)).toEqual([
      ".a/b/plugin.json",
      ".plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("reads the kind it was asked for, and nothing from a profile that declares none", () => {
    const catalog = catalogOf([
      aProfile("claude").withMarketplaceProbe(["m.json"]).build(),
      aProfile("cursor").build(),
    ]);

    expect(distributionProbesOf(catalog.sortedById(), "marketplace")).toEqual([
      { format: "claude", relativePath: "m.json" },
    ]);
    expect(distributionProbesOf(catalog.sortedById(), "manifest")).toEqual([]);
  });
});
