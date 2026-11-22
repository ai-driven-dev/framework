import { describe, expect, it } from "vitest";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import { aiSpec, ideSpec, refusalOf, settings } from "../../testing/define-tool-spec.builder.js";
import { flatPlugins, nativePlugins, sectionsOf } from "../../testing/plugin-mode.builder.js";

describe("defineAiTool", () => {
  it("builds a section with the directory and the suffix the profile stated once", () => {
    const tool = defineAiTool({
      ...aiSpec,
      capabilities: (bound) => ({
        commands: bound.commands({
          buildInstallPath: bound.installUnder("commands/"),
          convertFrontmatter: (frontmatter) => frontmatter,
        }),
      }),
    });

    expect(tool.section("commands").buildInstallPath("run.claude.md")).toBe(".x/commands/run.md");
  });

  it("answers a markdown section by kind, and null for a kind it does not declare", () => {
    const tool = defineAiTool({
      ...aiSpec,
      capabilities: (bound) => ({
        commands: bound.commands({
          buildInstallPath: bound.installUnder("commands/"),
          convertFrontmatter: (frontmatter) => frontmatter,
        }),
      }),
    });

    expect(tool.markdownSection("commands")?.buildInstallPath("run.claude.md")).toBe(
      ".x/commands/run.md"
    );
    expect(tool.markdownSection("agents")).toBeNull();
  });

  it("answers whether it declares skills", () => {
    const tool = defineAiTool({
      ...aiSpec,
      capabilities: (bound) => ({ skills: bound.skills({}) }),
    });

    expect(tool.declaresSkills()).toBe(true);
    expect(defineAiTool(aiSpec).declaresSkills()).toBe(false);
  });

  it("answers a declared section, and null for one it does not declare", () => {
    const tool = defineAiTool({ ...aiSpec, capabilities: () => ({ config: [settings] }) });

    expect(tool.section("config")).toStrictEqual([settings]);
    expect(tool.section("mcp")).toBeNull();
  });

  it("answers the native activation of a native plugins capability, and undefined for any other", () => {
    const native = nativePlugins({
      nativeActivation: { binary: "x", enableVerb: "add", disableVerb: "remove" },
    });

    const activated = defineAiTool({ ...aiSpec, capabilities: () => sectionsOf(native) });
    const unactivated = defineAiTool({
      ...aiSpec,
      capabilities: () => sectionsOf(nativePlugins()),
    });
    const flat = defineAiTool({
      ...aiSpec,
      capabilities: () => sectionsOf(flatPlugins("refuses")),
    });

    expect(activated.nativeActivation()).toBeDefined();
    expect(unactivated.nativeActivation()).toBeUndefined();
    expect(flat.nativeActivation()).toBeUndefined();
    expect(defineAiTool(aiSpec).nativeActivation()).toBeUndefined();
  });

  it("refuses an absolute directory", () => {
    expect(refusalOf(() => defineAiTool({ ...aiSpec, directory: "/abs/" })).invariant).toBe(
      "directory-not-relative"
    );
  });

  it("refuses a directory without a trailing slash", () => {
    expect(refusalOf(() => defineAiTool({ ...aiSpec, directory: ".x" })).invariant).toBe(
      "directory-without-trailing-slash"
    );
  });

  it("refuses an AI tool declaring no build contract", () => {
    expect(refusalOf(() => defineAiTool({ ...aiSpec, buildContracts: {} })).invariant).toBe(
      "no-build-contract"
    );
  });

  it("refuses a section key no tool can declare", () => {
    const sections = { config: [settings], bogus: 1 };

    expect(
      refusalOf(() => defineAiTool({ ...aiSpec, capabilities: () => sections })).invariant
    ).toBe("unknown-section");
  });

  it("refuses shipped config repeating a name", () => {
    const shipped = (destination: string) => ({
      name: "settings.json",
      content: {},
      destination,
      delivery: "install" as const,
    });

    const refusal = refusalOf(() =>
      defineAiTool({ ...aiSpec, configAssets: [shipped(".x/a.json"), shipped(".x/b.json")] })
    );

    expect(refusal.invariant).toBe("shipped-config-disagrees");
    expect(refusal.detail).toContain("settings.json");
  });

  it("refuses a section's shipped config landing elsewhere than the section writes it", () => {
    const shipped = (destination: string) => [
      { name: "settings.json", content: {}, destination, delivery: "section" as const },
    ];
    const build = (destination: string) =>
      defineAiTool({
        ...aiSpec,
        configAssets: shipped(destination),
        capabilities: () => ({ config: [settings] }),
      });

    expect(refusalOf(() => build(".x/elsewhere.json")).invariant).toBe("shipped-config-disagrees");
    expect(build(".x/settings.json").configAsset("settings.json")).toBeDefined();
  });

  it("is the only way to a branded profile", () => {
    const literal: AiTool = { ...defineAiTool(aiSpec), section: () => null };

    // @ts-expect-error a literal profile lacks the brand, so it cannot sit in the registration list
    const branded: ProfileBrand = literal;

    expect(branded).toBe(literal);
  });
});

describe("defineIdeTool", () => {
  it("refuses an absolute directory", () => {
    expect(refusalOf(() => defineIdeTool({ ...ideSpec, directory: "/abs/" })).invariant).toBe(
      "directory-not-relative"
    );
  });

  it("refuses a directory without a trailing slash", () => {
    expect(refusalOf(() => defineIdeTool({ ...ideSpec, directory: ".x" })).invariant).toBe(
      "directory-without-trailing-slash"
    );
  });

  it("refuses a section key no tool can declare", () => {
    const sections = { config: [settings], bogus: 1 };

    expect(
      refusalOf(() => defineIdeTool({ ...ideSpec, capabilities: () => sections })).invariant
    ).toBe("unknown-section");
  });

  it("refuses shipped config repeating a name", () => {
    const shipped = (destination: string) => ({
      name: "settings.json",
      content: {},
      destination,
      delivery: "install" as const,
    });

    const refusal = refusalOf(() =>
      defineIdeTool({ ...ideSpec, configAssets: [shipped(".x/a.json"), shipped(".x/b.json")] })
    );

    expect(refusal.invariant).toBe("shipped-config-disagrees");
    expect(refusal.detail).toContain("settings.json");
  });

  it("refuses a section's shipped config landing elsewhere than the section writes it", () => {
    const shipped = (destination: string) => [
      { name: "settings.json", content: {}, destination, delivery: "section" as const },
    ];
    const build = (destination: string) =>
      defineIdeTool({
        ...ideSpec,
        configAssets: shipped(destination),
        capabilities: () => ({ config: [settings] }),
      });

    expect(refusalOf(() => build(".x/elsewhere.json")).invariant).toBe("shipped-config-disagrees");
    expect(build(".x/settings.json").configAsset("settings.json")).toBeDefined();
  });
});
