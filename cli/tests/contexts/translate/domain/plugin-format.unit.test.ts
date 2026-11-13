import { describe, expect, it } from "vitest";
import { distributionProbesOf } from "../../../../src/contexts/translate/domain/plugin-format.js";
import { aCatalog, aProfile } from "../../tools/testing/profiles.js";

describe("distributionProbesOf", () => {
  // Order is behaviour: the reader takes the first probe that resolves, and a bare
  // `plugin.json` at the root is satisfied by almost any directory.
  it("puts the deepest path first and a bare filename last", () => {
    const catalog = aCatalog(
      aProfile("claude").withManifestProbe(["plugin.json"]).build(),
      aProfile("copilot").withManifestProbe([".plugin/plugin.json", ".a/b/plugin.json"]).build()
    );

    const probes = distributionProbesOf(catalog.getAllRegisteredTools(), "manifest");

    expect(probes.map((probe) => probe.relativePath)).toEqual([
      ".a/b/plugin.json",
      ".plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("reads the kind it was asked for, and nothing from a profile that declares none", () => {
    const catalog = aCatalog(
      aProfile("claude").withMarketplaceProbe(["m.json"]).build(),
      aProfile("cursor").build()
    );

    expect(distributionProbesOf(catalog.getAllRegisteredTools(), "marketplace")).toEqual([
      { format: "claude", relativePath: "m.json" },
    ]);
    expect(distributionProbesOf(catalog.getAllRegisteredTools(), "manifest")).toEqual([]);
  });
});
