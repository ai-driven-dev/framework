import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  MarketplaceSettings,
  NativeActivationSpec,
  NativeRegistrationSection,
} from "../../../../../src/contexts/host-registration/contract/native-registration-spec.js";
import { withNativeRegistration } from "../../../../../src/contexts/host-registration/domain/native-registration/native-host-profile.js";

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

/** A content profile: whether it reaches a user scope on its own, whether it takes plugins, and
 * one answer of its own that assembling must keep. */
function contentProfile(plugins: object | null, userScope = false) {
  return {
    supportsUserScopeActivation: () => userScope,
    plugins: () => plugins,
    frameworkBuildMode: () => "marketplace",
  };
}

function nativeTool(section: NativeRegistrationSection) {
  return withNativeRegistration(contentProfile({}), section);
}

describe("a content profile assembled with its native-registration section", () => {
  it("answers no activation, no marketplace and no machine-local file for an empty section", () => {
    const tool = nativeTool({});

    expect(tool.nativeActivation()).toBeUndefined();
    expect(tool.marketplaceRegistration()).toBeNull();
    expect(tool.machineLocalFiles()).toStrictEqual([]);
  });

  it("keeps every content answer of the profile it assembles", () => {
    expect(nativeTool({}).frameworkBuildMode()).toBe("marketplace");
  });

  it("supports a user scope through its own CLI only for a tool with plugins", () => {
    const pluginless = contentProfile(null);

    expect(nativeTool({}).supportsUserScopeActivation()).toBe(false);
    expect(nativeTool({ activation: activation() }).supportsUserScopeActivation()).toBe(true);
    expect(
      withNativeRegistration(pluginless, { activation: activation() }).supportsUserScopeActivation()
    ).toBe(false);
  });

  it("answers the server a tool takes plugins through, and reaches a user scope with it for a tool with plugins", () => {
    const server = {
      binary: "kimi",
      args: ["web"],
      bannerPattern: "(a)(b)",
      pluginsPath: "/plugins",
      notInstalledCode: 1,
    };

    expect(nativeTool({}).pluginServer()).toBeUndefined();
    expect(nativeTool({ pluginServer: server }).pluginServer()).toBe(server);
    expect(nativeTool({ pluginServer: server }).supportsUserScopeActivation()).toBe(true);
    expect(
      withNativeRegistration(contentProfile(null), {
        pluginServer: server,
      }).supportsUserScopeActivation()
    ).toBe(false);
  });

  it("keeps the user scope the content profile reaches on its own", () => {
    const user = contentProfile({}, true);

    expect(withNativeRegistration(user, {}).supportsUserScopeActivation()).toBe(true);
  });

  it("names a user settings file only where activation declares one", () => {
    const userFile = (extra: Partial<NativeActivationSpec>) =>
      nativeTool({ activation: activation(extra) })
        .nativeActivation()
        ?.userSettingsFile("/home/me", NO_ENV);

    expect(userFile({})).toBeUndefined();
    expect(
      userFile({ userSettingsPath: { env: "X", fallback: "{home}", fileName: "settings.json" } })
    ).toBe(join("/home/me", "settings.json"));
  });

  it("keeps a machine-local file only where the marketplace settings name one", () => {
    const local = (path: string | null) =>
      nativeTool({ activation: activation(), marketplace: settingsAt(path) });

    expect(local(".fake/settings.local.json").machineLocalFiles()).toStrictEqual([
      ".fake/settings.local.json",
    ]);
    expect(local(".fake/settings.local.json").marketplaceRegistration()?.sharedSettingsFile()).toBe(
      ".fake/settings.json"
    );
    expect(local(null).machineLocalFiles()).toStrictEqual([]);
  });

  it("makes plugin enablement machine-global without scopeArgs, and not with them", () => {
    const scoped = { project: ["--local"], user: ["--user"] };

    expect(nativeTool({}).pluginEnablementIsMachineGlobal()).toBe(true);
    expect(nativeTool({ activation: activation() }).pluginEnablementIsMachineGlobal()).toBe(true);
    expect(
      nativeTool({
        activation: activation({ scopeArgs: scoped }),
      }).pluginEnablementIsMachineGlobal()
    ).toBe(false);
  });

  it("counts a host ref in use as its activation says, and every ref without one", () => {
    const leaving = nativeTool({ activation: activation({ uninstallLeavesRefDisabled: true }) });

    expect(leaving.hostRefInUse(true)).toBe(true);
    expect(leaving.hostRefInUse(false)).toBe(false);
    expect(nativeTool({ activation: activation() }).hostRefInUse(false)).toBe(true);
    expect(nativeTool({}).hostRefInUse(false)).toBe(true);
  });
});
