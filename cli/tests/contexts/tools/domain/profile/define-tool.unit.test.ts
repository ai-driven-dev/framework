import { describe, expect, it } from "vitest";
import type { MarketplaceSettings } from "../../../../../src/contexts/tools/domain/native-registration/marketplace-settings.js";
import type { NativeActivationSpec } from "../../../../../src/contexts/tools/domain/native-registration/native-activation.js";
import {
  defineAiTool,
  defineIdeTool,
  type ProfileBrand,
} from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import type { AiTool } from "../../../../../src/contexts/tools/domain/profile.js";
import { ConfigSection } from "../../../../../src/contexts/tools/domain/sections/config-section.js";
import { InvalidToolProfileError } from "../../../../../src/shared/domain/errors.js";
import {
  flatPlugins,
  nativePlugins,
  type PluginSet,
  sectionsOf,
} from "../../testing/plugin-mode.js";
import { anEmptyContract, aProfile, projectMergeDelivery } from "../../testing/profiles.js";

const settings = new ConfigSection({
  outputPath: ".x/settings.json",
  mergeStrategy: "none",
});

const aiSpec = {
  toolId: "claude" as const,
  directory: ".x/",
  toolSuffix: ".claude.md",
  signalDir: null,
  displayName: "X",
  buildContracts: { flat: () => anEmptyContract() },
  capabilities: () => ({}),
  rewriteContent: (content: string) => content,
};

const ideSpec = {
  toolId: "vscode" as const,
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
    expect(refusal.message).toContain("settings.json");
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
    expect(refusal.message).toContain("settings.json");
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
    const supports = (plugins: PluginSet) =>
      aProfile("cursor").withPlugins(plugins).build().supportsUserScopeActivation();

    expect(supports(nativePlugins())).toBe(false);
    expect(supports(nativePlugins({ nativeActivation: activation() }))).toBe(true);
    expect(
      supports(nativePlugins({ installScope: "user", userPluginsDir: (home) => `${home}/.x` }))
    ).toBe(true);
  });

  it("names the project hooks file only for a profile merging hooks into the project", () => {
    const merging = nativePlugins({
      hooks: projectMergeDelivery(),
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
      hooks: projectMergeDelivery(),
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

describe("plugin sections that disagree", () => {
  const refused = (sections: object) =>
    refusalOf(() => defineAiTool({ ...aiSpec, capabilities: () => sections }));
  const native = nativePlugins();
  const flat = flatPlugins("refuses");

  it("refuses a native layout without a manifest", () => {
    const error = refused({ layout: native.layout, hooks: native.hooks });

    expect([error.invariant, error.message]).toEqual([
      "plugin-sections-disagree",
      "The profile of 'claude' breaks 'plugin-sections-disagree': a native layout requires a manifest section.",
    ]);
  });

  it("refuses a manifest beside a layout that is not native", () => {
    const sections = sectionsOf(flat);

    expect(refused({ ...sections, manifest: native.manifest }).message).toContain(
      "a flat layout takes no manifest section."
    );
  });

  it("refuses a manifest with no layout", () => {
    expect(refused({ manifest: native.manifest }).message).toContain(
      "a manifest needs a native layout."
    );
  });

  it("refuses a layout with no hooks section to state its delivery", () => {
    expect(refused({ layout: flat.layout }).message).toContain(
      "a layout requires a hooks section to state its delivery."
    );
  });

  it("refuses a hooks delivery its layout cannot take", () => {
    const bridge = { delivery: { kind: "bridge", flat: { dir: ".x/hooks/" } } } as const;

    expect(refused({ ...sectionsOf(native), hooks: bridge }).message).toContain(
      "hooks delivery 'bridge' does not suit a native layout."
    );
  });
});

describe("what a refused profile says", () => {
  const sayOf = (build: () => unknown) => refusalOf(build).message;
  const shipped = (name: string, destination: string, delivery: "install" | "section") => ({
    name,
    content: {},
    destination,
    delivery,
  });

  it("names the tool and the directory it refuses", () => {
    expect(sayOf(() => defineAiTool({ ...aiSpec, directory: "/abs/" }))).toBe(
      "The profile of 'claude' breaks 'directory-not-relative': '/abs/' must be relative to the project root."
    );
    expect(sayOf(() => defineAiTool({ ...aiSpec, directory: ".x" }))).toBe(
      "The profile of 'claude' breaks 'directory-without-trailing-slash': '.x' must end with '/'."
    );
  });

  it("names the section no tool can declare", () => {
    expect(
      sayOf(() =>
        defineAiTool({ ...aiSpec, capabilities: () => ({ config: [settings], bogus: 1 }) })
      )
    ).toBe("The profile of 'claude' breaks 'unknown-section': 'bogus' is no section.");
  });

  it("says an AI tool needs a marketplace or a flat build contract", () => {
    expect(sayOf(() => defineAiTool({ ...aiSpec, buildContracts: {} }))).toBe(
      "The profile of 'claude' breaks 'no-build-contract': an AI tool declares a marketplace or a flat build contract."
    );
  });

  it("names the shipped file declared twice, and the one no section writes", () => {
    expect(
      sayOf(() =>
        defineAiTool({
          ...aiSpec,
          configAssets: [
            shipped("a.json", ".x/a", "install"),
            shipped("a.json", ".x/b", "install"),
          ],
        })
      )
    ).toBe("The profile of 'claude' breaks 'shipped-config-disagrees': 'a.json' is shipped twice.");
    expect(
      sayOf(() =>
        defineAiTool({ ...aiSpec, configAssets: [shipped("a.json", ".x/a.json", "section")] })
      )
    ).toBe(
      "The profile of 'claude' breaks 'shipped-config-disagrees': 'a.json' lands at .x/a.json, which no settings section writes."
    );
  });
});

describe("a profile that declares no plugin layout, no mcp and no activation", () => {
  const bare = defineAiTool(aiSpec);

  it("builds as a marketplace and shares no flat plugin mcp", () => {
    expect(bare.frameworkBuildMode()).toBe("marketplace");
    expect([bare.mcpConfig(), bare.flatPluginMcp()]).toStrictEqual([null, null]);
  });

  it("keeps plugin enablement machine-global", () => {
    expect(bare.pluginEnablementIsMachineGlobal()).toBe(true);
  });

  it("places and owns a native tool's skills as nested ones", () => {
    const native = defineAiTool({ ...aiSpec, capabilities: () => sectionsOf(nativePlugins()) });

    expect(native.ownsFlatPath(".x/skills/p/plan/SKILL.md", "p")).toBe(true);
    expect(native.ownsFlatPath(".x/skills/p-plan/SKILL.md", "p")).toBe(false);
    expect(native.pluginEnablementIsMachineGlobal()).toBe(true);
  });
});
