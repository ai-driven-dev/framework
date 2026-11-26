import { describe, expect, it } from "vitest";
import { upstreamRemoved } from "../../../../src/contexts/installation/contract/plugin-sources.js";
import { SYNTHETIC_TOOL } from "../../../shared/testing/synthetic-tool-id.builder.js";

const source = (marketplace: string, plugin: string) => ({
  toolId: SYNTHETIC_TOOL,
  plugin,
  marketplace,
});

describe("finding the installed plugins a marketplace dropped", () => {
  it("lists the installed plugins of the marketplace its catalog no longer names", () => {
    const installed = [source("m", "kept"), source("m", "gone")];
    expect(upstreamRemoved(installed, "m", new Set(["kept"]))).toEqual([source("m", "gone")]);
  });

  it("ignores a plugin installed from another marketplace", () => {
    expect(upstreamRemoved([source("other", "gone")], "m", new Set())).toEqual([]);
  });

  it("lists nothing when the catalog names every installed plugin", () => {
    expect(upstreamRemoved([source("m", "a")], "m", new Set(["a"]))).toEqual([]);
  });
});
