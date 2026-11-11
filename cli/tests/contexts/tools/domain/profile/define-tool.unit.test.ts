import { describe, expect, it } from "vitest";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/capabilities/settings-capability.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/contracts.js";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { InvalidToolProfileError } from "../../../../../src/kernel/errors.js";
import { anEmptyContract } from "../../testing/profiles.js";

const settings = new SettingsCapability({
  outputPath: ".x/settings.json",
  mergeStrategy: "none",
});

const aiSpec = {
  toolId: "claude",
  directory: ".x/",
  toolSuffix: ".claude.md",
  signalDir: null,
  displayName: "X",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  rewriteContent: (content: string) => content,
};

const ideSpec = {
  toolId: "vscode",
  directory: ".x/",
  signalDir: null,
  capabilities: () => ({}),
};

function refusalOf(build: () => unknown): InvalidToolProfileError {
  try {
    build();
  } catch (error) {
    if (error instanceof InvalidToolProfileError) return error;
    throw error;
  }
  throw new Error("the profile was accepted");
}

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

  it("answers a declared section, and null for one it does not declare", () => {
    const tool = defineAiTool({ ...aiSpec, capabilities: () => ({ settings: [settings] }) });

    expect(tool.section("settings")).toStrictEqual([settings]);
    expect(tool.section("mcp")).toBeNull();
  });

  it("answers from its own sections once detached from the profile", () => {
    const { section } = defineAiTool({ ...aiSpec, capabilities: () => ({ settings: [settings] }) });

    expect(section("settings")).toStrictEqual([settings]);
    expect(section("mcp")).toBeNull();
  });

  it("refuses an id no AI tool carries", () => {
    expect(refusalOf(() => defineAiTool({ ...aiSpec, toolId: "emacs" })).invariant).toBe(
      "unknown-tool-id"
    );
  });

  it("refuses an IDE id as an AI tool", () => {
    expect(refusalOf(() => defineAiTool({ ...aiSpec, toolId: "vscode" })).invariant).toBe(
      "unknown-tool-id"
    );
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
    const sections = { settings: [settings], bogus: 1 };

    expect(
      refusalOf(() => defineAiTool({ ...aiSpec, capabilities: () => sections })).invariant
    ).toBe("unknown-section");
  });

  it("is the only way to a branded profile", () => {
    const literal: AiTool = { ...defineAiTool(aiSpec), section: () => null };

    // @ts-expect-error a literal profile lacks the brand, so it cannot sit in the registration list
    const branded: ProfileBrand = literal;

    expect(branded).toBe(literal);
  });
});

describe("defineIdeTool", () => {
  it("answers a declared section", () => {
    const tool = defineIdeTool({ ...ideSpec, capabilities: () => ({ settings: [settings] }) });

    expect(tool.section("settings")).toStrictEqual([settings]);
  });

  it("refuses an id no IDE tool carries", () => {
    expect(refusalOf(() => defineIdeTool({ ...ideSpec, toolId: "claude" })).invariant).toBe(
      "unknown-tool-id"
    );
  });

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
    const sections = { settings: [settings], bogus: 1 };

    expect(
      refusalOf(() => defineIdeTool({ ...ideSpec, capabilities: () => sections })).invariant
    ).toBe("unknown-section");
  });
});
