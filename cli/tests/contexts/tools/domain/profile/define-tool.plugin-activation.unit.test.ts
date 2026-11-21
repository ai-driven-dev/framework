import { describe, expect, it } from "vitest";
import type {
  MarketplaceSettings,
  NativeActivationSpec,
} from "../../../../../src/contexts/tools/contract/native-registration-spec.js";
import { defineAiTool } from "../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { aiSpec } from "../../testing/define-tool-spec.builder.js";
import {
  flatPlugins,
  nativePlugins,
  type PluginSet,
  sectionsOf,
} from "../../testing/plugin-mode.builder.js";
import { aProfile, projectMergeDelivery } from "../../testing/profiles.builder.js";

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
    const profile = aProfile(TOOL.cursor).withPlugins(undefined).build();

    expect(profile.nativeActivation()).toBeUndefined();
    expect(profile.projectHooksDelivery()).toBeNull();
    expect(profile.supportsUserScopeActivation()).toBe(false);
    expect(profile.plugins()).toBeNull();
  });

  it("supports a user scope through its own CLI, or a user-scope install directory, and not otherwise", () => {
    const supports = (plugins: PluginSet) =>
      aProfile(TOOL.cursor).withPlugins(plugins).build().supportsUserScopeActivation();

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

    const named = aProfile(TOOL.cursor).withPlugins(merging).build();
    const unnamed = aProfile(TOOL.cursor).withPlugins(nativePlugins()).build();

    expect(named.projectHooksDelivery()?.relativePath).toBe(".fake/hooks.json");
    expect(unnamed.projectHooksDelivery()).toBeNull();
  });

  it("names a user settings file only where activation declares one", () => {
    const userFile = (extra: Partial<NativeActivationSpec>) =>
      aProfile(TOOL.cursor)
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
      aProfile(TOOL.cursor)
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

    const profile = aProfile(TOOL.cursor).withPlugins(merging).build();

    expect(profile.marketplaceRegistration()?.machineLocalFiles() ?? []).not.toContain(
      ".fake/hooks.json"
    );
  });

  it("builds a flat profile flat and a native one as a marketplace", () => {
    expect(
      aProfile(TOOL.opencode).withPlugins(flatPlugins("refuses")).build().frameworkBuildMode()
    ).toBe("flat");
    expect(aProfile(TOOL.claude).withPlugins(nativePlugins()).build().frameworkBuildMode()).toBe(
      "marketplace"
    );
  });

  it("makes plugin enablement machine-global without scopeArgs, and not with them", () => {
    const withActivation = (extra: Partial<NativeActivationSpec>) =>
      aProfile(TOOL.cursor)
        .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
        .build();
    const scoped = { project: ["--local"], user: ["--user"] };

    expect(withActivation({}).pluginEnablementIsMachineGlobal()).toBe(true);
    expect(withActivation({ scopeArgs: scoped }).pluginEnablementIsMachineGlobal()).toBe(false);
  });

  it("answers on the profile whether a host ref is in use, and counts every ref in use for a tool with no native activation", () => {
    const native = (extra: Partial<NativeActivationSpec>) =>
      aProfile(TOOL.cursor)
        .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
        .build();

    expect(native({ uninstallLeavesRefDisabled: true }).hostRefInUse(true)).toBe(true);
    expect(native({ uninstallLeavesRefDisabled: true }).hostRefInUse(false)).toBe(false);
    expect(native({}).hostRefInUse(false)).toBe(true);
    expect(
      aProfile(TOOL.opencode).withPlugins(flatPlugins("refuses")).build().hostRefInUse(false)
    ).toBe(true);
  });

  it("copies plugin files globally only for a user-scope install", () => {
    const user = nativePlugins({ installScope: "user", userPluginsDir: (home) => `${home}/.x` });

    expect(aProfile(TOOL.cursor).withPlugins(user).build().plugins()?.copiesFilesGlobally()).toBe(
      true
    );
    expect(
      aProfile(TOOL.cursor).withPlugins(nativePlugins()).build().plugins()?.copiesFilesGlobally()
    ).toBe(false);
  });

  it("hands back the build contract of a mode a profile declares, and none for another", () => {
    const claude = aProfile(TOOL.claude).build();

    expect(claude.buildContract("flat")).not.toBeNull();
    expect(claude.buildContract("marketplace")).toBeNull();
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
