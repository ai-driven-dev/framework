import { describe, expect, it } from "vitest";
import {
  buildTargetModesOf,
  supportedBuildTargets,
} from "../../../../src/contexts/translate/contract/build-targets.js";
import { distributionProbesOf } from "../../../../src/contexts/translate/domain/plugin-format.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { catalogDeclaring } from "../testing/declared-tool-catalog.builder.js";

describe("listing the probes that detect a distribution", () => {
  // Order is behaviour: the reader takes the first probe that resolves, and a bare
  // `plugin.json` at the root is satisfied by almost any directory.
  it("puts the deepest path first and a bare filename last", () => {
    const catalog = catalogDeclaring([
      { id: TOOL.claude, manifestPaths: ["plugin.json"] },
      { id: TOOL.copilot, manifestPaths: [".plugin/plugin.json", ".a/b/plugin.json"] },
    ]);

    const probes = distributionProbesOf(catalog, "manifest");

    expect(probes.map((probe) => probe.relativePath)).toEqual([
      ".a/b/plugin.json",
      ".plugin/plugin.json",
      "plugin.json",
    ]);
  });

  it("reads the kind it was asked for, and nothing from a profile that declares none", () => {
    const catalog = catalogDeclaring([
      { id: TOOL.claude, marketplacePaths: ["m.json"] },
      { id: TOOL.cursor },
    ]);

    expect(distributionProbesOf(catalog, "marketplace")).toEqual([
      { format: "claude", relativePath: "m.json" },
    ]);
    expect(distributionProbesOf(catalog, "manifest")).toEqual([]);
  });

  it("breaks a tie between equally deep paths in the order the tools were registered", () => {
    const cursorFirst = catalogDeclaring([
      { id: TOOL.cursor, manifestPaths: [".cursor-plugin/plugin.json"] },
      { id: TOOL.claude, manifestPaths: [".claude-plugin/plugin.json"] },
    ]);
    const claudeFirst = catalogDeclaring([
      { id: TOOL.claude, manifestPaths: [".claude-plugin/plugin.json"] },
      { id: TOOL.cursor, manifestPaths: [".cursor-plugin/plugin.json"] },
    ]);

    expect(distributionProbesOf(cursorFirst, "manifest").map((probe) => probe.format)).toEqual([
      "claude",
      "cursor",
    ]);
    expect(distributionProbesOf(claudeFirst, "manifest").map((probe) => probe.format)).toEqual([
      "claude",
      "cursor",
    ]);
  });
});

describe("listing the build modes of tools", () => {
  it("gives a tool one pair per contract it declares, and none for what it omits", () => {
    const catalog = catalogDeclaring([
      { id: TOOL.claude, buildModes: ["marketplace", "flat"] },
      { id: TOOL.opencode, buildModes: ["flat"] },
    ]);

    expect(buildTargetModesOf(catalog)).toEqual([
      { target: "claude", mode: "marketplace" },
      { target: "claude", mode: "flat" },
      { target: "opencode", mode: "flat" },
    ]);
  });
});

describe("listing the supported build targets", () => {
  it("lists the registered targets in the shared tool order, which the usage message prints", () => {
    expect(supportedBuildTargets(registeredTools())).toEqual([
      "claude",
      "cursor",
      "copilot",
      "opencode",
      "kilo",
      "codex",
      "antigravity",
      "kiro",
      "kimi",
    ]);
  });
});
