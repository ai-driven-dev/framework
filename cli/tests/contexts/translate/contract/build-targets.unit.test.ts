import { describe, expect, it } from "vitest";
import {
  buildTargetModesOf,
  supportedBuildTargets,
} from "../../../../src/contexts/translate/contract/build-targets.js";
import { TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { catalogDeclaring } from "../testing/declared-tool-catalog.builder.js";

describe("buildTargetModesOf", () => {
  it("pairs each tool with every mode its profile declares a contract for", () => {
    const tools = catalogDeclaring([
      { id: TOOL.claude, buildModes: ["marketplace", "flat"] },
      { id: TOOL.codex, buildModes: ["flat"] },
    ]);

    expect(buildTargetModesOf(tools)).toEqual([
      { target: TOOL.claude, mode: "marketplace" },
      { target: TOOL.claude, mode: "flat" },
      { target: TOOL.codex, mode: "flat" },
    ]);
  });

  it("skips a tool that declares no mode", () => {
    const tools = catalogDeclaring([{ id: TOOL.claude }, { id: TOOL.codex, buildModes: ["flat"] }]);

    expect(buildTargetModesOf(tools)).toEqual([{ target: TOOL.codex, mode: "flat" }]);
  });

  it("follows the canonical order of tools, not the order they were given", () => {
    const given = catalogDeclaring([
      { id: TOOL.codex, buildModes: ["flat"] },
      { id: TOOL.claude, buildModes: ["flat"] },
    ]);
    const reversed = catalogDeclaring([
      { id: TOOL.claude, buildModes: ["flat"] },
      { id: TOOL.codex, buildModes: ["flat"] },
    ]);

    expect(buildTargetModesOf(given)).toEqual(buildTargetModesOf(reversed));
  });
});

describe("supportedBuildTargets", () => {
  it("names each target once, however many modes it supports", () => {
    const tools = catalogDeclaring([
      { id: TOOL.claude, buildModes: ["marketplace", "flat"] },
      { id: TOOL.codex },
    ]);

    expect(supportedBuildTargets(tools)).toEqual([TOOL.claude]);
  });
});
