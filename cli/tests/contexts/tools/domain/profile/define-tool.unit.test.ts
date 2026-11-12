import { describe, expect, it } from "vitest";
import type { MarketplaceSettings } from "../../../../../src/contexts/tools/domain/native-registration/marketplace-settings.js";
import type { NativeActivationSpec } from "../../../../../src/contexts/tools/domain/native-registration/native-activation.js";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import { SettingsCapability } from "../../../../../src/contexts/tools/domain/sections/settings-capability.js";
import { InvalidToolProfileError } from "../../../../../src/kernel/errors.js";
import {
  anEmptyContract,
  aProfile,
  flatPlugins,
  nativePlugins,
  PROJECT_HOOKS_FORMAT,
} from "../../testing/profiles.js";

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

  it("answers its skills section, and null when it declares none", () => {
    const tool = defineAiTool({
      ...aiSpec,
      capabilities: (bound) => ({
        skills: bound.skills({
          buildInstallPath: bound.installUnder("skills/"),
          convertFrontmatter: (frontmatter) => frontmatter,
        }),
      }),
    });

    expect(tool.skillsSection()?.convertFrontmatter({ a: 1 })).toStrictEqual({ a: 1 });
    expect(defineAiTool(aiSpec).skillsSection()).toBeNull();
  });

  it("answers a declared section, and null for one it does not declare", () => {
    const tool = defineAiTool({ ...aiSpec, capabilities: () => ({ settings: [settings] }) });

    expect(tool.section("settings")).toStrictEqual([settings]);
    expect(tool.section("mcp")).toBeNull();
  });

  it("answers the native activation of a native plugins capability, and undefined for any other", () => {
    const native = nativePlugins({
      nativeActivation: { binary: "x", enableVerb: "add", disableVerb: "remove" },
    });

    const activated = defineAiTool({ ...aiSpec, capabilities: () => ({ plugins: native }) });
    const unactivated = defineAiTool({
      ...aiSpec,
      capabilities: () => ({ plugins: nativePlugins() }),
    });
    const flat = defineAiTool({
      ...aiSpec,
      capabilities: () => ({ plugins: flatPlugins("refuses") }),
    });

    expect(activated.nativeActivation()).toBeDefined();
    expect(unactivated.nativeActivation()).toBeUndefined();
    expect(flat.nativeActivation()).toBeUndefined();
    expect(defineAiTool(aiSpec).nativeActivation()).toBeUndefined();
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

const NO_ENV = () => undefined;

function activation(extra: Partial<NativeActivationSpec> = {}): NativeActivationSpec {
  return { binary: "codex", enableVerb: "add", disableVerb: "remove", ...extra };
}

function settingsAt(path: string | null): MarketplaceSettings {
  return {
    settingsPath: ".fake/settings.json",
    settingsKey: "k",
    marketplacesSettingsPath: path,
    toEntryKey: () => null,
  };
}

describe("what a profile's plugins capability says about activation", () => {
  it("names no native activation, no project hooks file and no user scope without a plugins capability", () => {
    const profile = aProfile("cursor").withPlugins(undefined).build();

    expect(profile.nativeActivation()).toBeUndefined();
    expect(profile.projectHooksDelivery()).toBeNull();
    expect(profile.supportsUserScopeActivation()).toBe(false);
    expect(profile.plugins()).toBeNull();
  });

  it("supports a user scope through its own CLI, or a user-scope install directory, and not otherwise", () => {
    const supports = (plugins: ReturnType<typeof nativePlugins>) =>
      aProfile("cursor").withPlugins(plugins).build().supportsUserScopeActivation();

    expect(supports(nativePlugins())).toBe(false);
    expect(supports(nativePlugins({ nativeActivation: activation() }))).toBe(true);
    expect(
      supports(nativePlugins({ installScope: "user", userPluginsDir: (home) => `${home}/.x` }))
    ).toBe(true);
  });

  it("names the project hooks file only for a profile merging hooks into the project", () => {
    const merging = nativePlugins({
      hooksDestination: "project",
      projectHooksRelativePath: ".fake/hooks.json",
      projectHooksFormat: PROJECT_HOOKS_FORMAT,
    });

    const named = aProfile("cursor").withPlugins(merging).build();
    const unnamed = aProfile("cursor").withPlugins(nativePlugins()).build();

    expect(named.projectHooksDelivery()?.relativePath).toBe(".fake/hooks.json");
    expect(unnamed.projectHooksDelivery()).toBeNull();
  });

  it("names a user settings file only where activation declares one", () => {
    const userFile = (extra: Partial<NativeActivationSpec>) =>
      aProfile("cursor")
        .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
        .build()
        .nativeActivation()
        ?.userSettingsFile("/home/me", NO_ENV);

    expect(userFile({})).toBeUndefined();
    expect(
      userFile({ userSettingsPath: (home, env) => `${home}/${env("X") ?? "settings.json"}` })
    ).toBe("/home/me/settings.json");
  });

  it("keeps a machine-local file only where the settings name one", () => {
    const local = (path: string | null) =>
      aProfile("cursor")
        .withPlugins(
          nativePlugins({ marketplaceSettings: settingsAt(path), nativeActivation: activation() })
        )
        .build()
        .marketplaceRegistration()
        ?.machineLocalFiles();

    expect(local(".fake/settings.local.json")).toStrictEqual([".fake/settings.local.json"]);
    expect(local(null)).toStrictEqual([]);
  });

  it("keeps the project hooks file out of the machine-local files", () => {
    const merging = nativePlugins({
      hooksDestination: "project",
      projectHooksRelativePath: ".fake/hooks.json",
      projectHooksFormat: PROJECT_HOOKS_FORMAT,
    });

    const profile = aProfile("cursor").withPlugins(merging).build();

    expect(profile.marketplaceRegistration()?.machineLocalFiles() ?? []).not.toContain(
      ".fake/hooks.json"
    );
  });

  it("builds a flat profile flat and a native one as a marketplace", () => {
    expect(
      aProfile("opencode").withPlugins(flatPlugins("refuses")).build().frameworkBuildMode()
    ).toBe("flat");
    expect(aProfile("claude").withPlugins(nativePlugins()).build().frameworkBuildMode()).toBe(
      "marketplace"
    );
  });

  it("makes plugin enablement machine-global without scopeArgs, and not with them", () => {
    const withActivation = (extra: Partial<NativeActivationSpec>) =>
      aProfile("cursor")
        .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
        .build();
    const scoped = { project: ["--local"], user: ["--user"] };

    expect(withActivation({}).pluginEnablementIsMachineGlobal()).toBe(true);
    expect(withActivation({ scopeArgs: scoped }).pluginEnablementIsMachineGlobal()).toBe(false);
  });

  it("answers on the profile whether a host ref is in use, and counts every ref in use for a tool with no native activation", () => {
    const native = (extra: Partial<NativeActivationSpec>) =>
      aProfile("cursor")
        .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
        .build();

    expect(native({ uninstallLeavesRefDisabled: true }).hostRefInUse(true)).toBe(true);
    expect(native({ uninstallLeavesRefDisabled: true }).hostRefInUse(false)).toBe(false);
    expect(native({}).hostRefInUse(false)).toBe(true);
    expect(
      aProfile("opencode").withPlugins(flatPlugins("refuses")).build().hostRefInUse(false)
    ).toBe(true);
  });

  it("copies plugin files globally only for a user-scope install", () => {
    const user = nativePlugins({ installScope: "user", userPluginsDir: (home) => `${home}/.x` });

    expect(aProfile("cursor").withPlugins(user).build().plugins()?.copiesFilesGlobally()).toBe(
      true
    );
    expect(
      aProfile("cursor").withPlugins(nativePlugins()).build().plugins()?.copiesFilesGlobally()
    ).toBe(false);
  });

  it("hands back the build contract of a mode a profile declares, and none for another", () => {
    const claude = aProfile("claude").build();

    expect(claude.buildContract("flat")).not.toBeNull();
    expect(claude.buildContract("marketplace")).toBeNull();
  });
});
