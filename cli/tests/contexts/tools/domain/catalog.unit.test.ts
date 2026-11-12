import { describe, expect, it } from "vitest";
import type { MarketplaceSettings } from "../../../../src/contexts/tools/domain/marketplace-settings.js";
import type { NativeActivationSpec } from "../../../../src/contexts/tools/domain/plugins/native-activation.js";
import { DuplicateToolIdError, UnregisteredToolError } from "../../../../src/kernel/errors.js";
import {
  aCatalog,
  anIdeProfile,
  aProfile,
  flatPlugins,
  nativePlugins,
  PROJECT_HOOKS_FORMAT,
} from "../testing/profiles.js";

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

describe("a catalog built from a list of profiles", () => {
  it("refuses two profiles declaring the same id", () => {
    expect(() => aCatalog(aProfile("cursor").build(), aProfile("cursor").build())).toThrow(
      DuplicateToolIdError
    );
  });

  it("throws for an id it does not hold", () => {
    expect(() => aCatalog().profile("cursor")).toThrow(UnregisteredToolError);
  });

  it("lists a category in the order its profiles were given, and all of them sorted by id", () => {
    const catalog = aCatalog(
      aProfile("cursor").build(),
      aProfile("claude").build(),
      anIdeProfile()
    );

    expect(catalog.inHelpOrder("ai")).toEqual(["cursor", "claude"]);
    expect(catalog.sortedById().map((profile) => profile.toolId)).toEqual([
      "claude",
      "cursor",
      "vscode",
    ]);
  });
});

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
