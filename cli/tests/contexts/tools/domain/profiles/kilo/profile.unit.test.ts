import { describe, expect, it } from "vitest";
import { kilo } from "../../../../../../src/contexts/tools/domain/profiles/kilo/profile.js";
import { distributionProbesOf } from "../../../../../../src/contexts/translate/domain/plugin-format.js";
import { FileHash } from "../../../../../../src/kernel/file.js";
import { flatHooksPathWithLoaderEntry } from "../../../../../../src/kernel/materialization/flat-paths.js";
import type { FileReader } from "../../../../../../src/kernel/ports/file-reader.js";
import { rulesRows, WRITES_NOTHING } from "../../../testing/profile-tables.js";
import { type InstallKind, installPathOf } from "../../../testing/profiles.js";

function _makeFs(existingPaths: string[]): FileReader {
  return {
    fileExists: async (path) =>
      existingPaths.includes(path.replaceAll("\\", "/").replace(/^\/project\//, "")),
    isExecutable: async () => false,
    realpath: async (path) => path,
    readFile: async () => "",
    readFileHash: async () => new FileHash("00000000000000000000000000000000"),
    listDirectory: async () => [],
    listFilesRecursive: async () => [],
  };
}

describe("kilo", () => {
  it("turns agents into Kilo subagents without copying host-specific metadata", () => {
    expect(
      kilo.section("agents").convertFrontmatter({
        name: "reviewer",
        description: "Review code",
        tools: ["Read"],
      })
    ).toEqual({ description: "Review code", mode: "subagent" });
  });

  it("preserves skill metadata", () => {
    const metadata = { name: "plan", description: "Plan work", license: "MIT" };
    expect(kilo.section("skills").convertFrontmatter(metadata)).toEqual(metadata);
  });

  it("namespaces commands by phase and omits argument hints unsupported by Kilo", () => {
    expect(
      kilo
        .section("commands")
        .convertFrontmatter(
          { name: "greet", description: "Greet someone", "argument-hint": "<name>" },
          "01-plan/greet.md"
        )
    ).toEqual({ name: "aidd:01:greet", description: "Greet someone" });
  });

  it("declares a flat build", () => {
    expect(kilo.buildContracts?.flat).toBeDefined();
  });

  it.each<[InstallKind, string, string]>([
    ["agents", "reviewer.kilo.md", ".kilo/agents/reviewer.md"],
    ["skills", "01-plan/SKILL.kilo.md", ".kilo/skills/01-plan/SKILL.md"],
    ["commands", "01-plan/greet.md", ".kilo/commands/aidd/01/greet.md"],
    ["rules", "standards.kilo.md", ".kilo/rules/standards.md"],
  ])("installs %s file %s at %s", (kind, built, path) => {
    expect(installPathOf(kilo, kind, built)).toBe(path);
  });

  it("delivers hook scripts under .kilo/hooks and generates a bridge under .kilo/plugin", () => {
    const plugins = kilo.section("plugins");
    expect([
      plugins.buildMode(),
      plugins.hooksAcceptance().accepts,
      plugins.flatLayout().hooksDir,
    ]).toStrictEqual(["flat", true, ".kilo/hooks/"]);
    expect(kilo.section("plugins").flatLayout().hooksBridge?.path("aidd-context")).toBe(
      ".kilo/plugin/aidd-context-hooks.js"
    );
    expect(
      flatHooksPathWithLoaderEntry(
        plugins.flatLayout().hooksDir ?? "",
        plugins.flatLayout().hooksLoaderEntry,
        "aidd-context",
        "hooks/kilo-plugin.js"
      )
    ).toBe(".kilo/plugin/aidd-context.js");
    expect(
      flatHooksPathWithLoaderEntry(
        plugins.flatLayout().hooksDir ?? "",
        plugins.flatLayout().hooksLoaderEntry,
        "aidd-context",
        "hooks/capture.cjs"
      )
    ).toBe(".kilo/hooks/aidd-context/capture.cjs");
  });
});

describe("kilo build and conversion tables", () => {
  it.each(
    rulesRows({
      ...WRITES_NOTHING,
      "a paths list": {},
      "globs that apply on request": { description: "d" },
      "paths beside a description": { description: "d" },
      "a description that opts out of always-apply": { description: "d" },
    })
  )("converts %s", (_case, frontmatter, expected) => {
    expect(kilo.section("rules").convertFrontmatter(frontmatter)).toStrictEqual(expected);
  });
});

describe("kilo as the registry answers for it", () => {
  it("probes a marketplace although it builds none natively", () => {
    expect(
      distributionProbesOf(new Map([[kilo.toolId, kilo]]), "marketplace").map(
        (probe) => probe.format
      )
    ).toEqual(["kilo"]);
  });

  it("installs its rules into .kilo/rules/ as markdown", () => {
    expect(kilo.section("rules").installedLocation()).toEqual({
      directory: ".kilo/rules/",
      extension: ".md",
    });
  });
});
