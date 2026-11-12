import { describe, expect, it } from "vitest";
import type { MarketplaceSettings } from "../../../../src/contexts/tools/domain/marketplace-settings.js";
import type { NativeActivationSpec } from "../../../../src/contexts/tools/domain/plugins/native-activation.js";
import { DuplicateToolIdError, UnregisteredToolError } from "../../../../src/kernel/errors.js";
import type { ToolId } from "../../../../src/kernel/tool.js";
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

function idsOf(catalog: ReturnType<typeof aCatalog>): ToolId[] {
  return [...catalog.getAllRegisteredTools().keys()];
}

describe("a catalog built from a list of profiles", () => {
  it("refuses two profiles declaring the same id", () => {
    expect(() => aCatalog(aProfile("cursor").build(), aProfile("cursor").build())).toThrow(
      DuplicateToolIdError
    );
  });

  it("refuses to replace the profile of an id it does not hold", () => {
    expect(() =>
      aCatalog(aProfile("cursor").build()).replacing(aProfile("claude").build())
    ).toThrow(UnregisteredToolError);
  });

  it("swaps the replaced profile and keeps the others, leaving the original catalog alone", () => {
    const original = aCatalog(aProfile("cursor").build(), aProfile("claude").build());
    const swapped = aProfile("cursor").withDirectory(".swapped/").build();

    const replaced = original.replacing(swapped);

    expect(replaced.getToolConfig("cursor")).toBe(swapped);
    expect(idsOf(replaced)).toEqual(["cursor", "claude"]);
    expect(original.getToolConfig("cursor")).not.toBe(swapped);
  });

  it("throws for an id it does not hold", () => {
    expect(() => aCatalog().getToolConfig("cursor")).toThrow(UnregisteredToolError);
  });

  it("hands out a copy of its profiles", () => {
    const catalog = aCatalog(aProfile("cursor").build());

    catalog.getAllRegisteredTools().clear();

    expect(idsOf(catalog)).toEqual(["cursor"]);
  });
});

describe("what a profile's plugins capability says about activation", () => {
  it("names no native activation, no project hooks file and no user scope without a plugins capability", () => {
    const catalog = aCatalog(aProfile("cursor").withPlugins(undefined).build());

    expect(catalog.nativeActivationOf("cursor")).toBeUndefined();
    expect(catalog.projectHooksFileOf("cursor")).toBeUndefined();
    expect(catalog.supportsUserScopeActivation("cursor")).toBe(false);
    expect(catalog.resolvePluginsCapability("cursor")).toBeNull();
  });

  it("supports a user scope through its own CLI, or a user-scope install directory, and not otherwise", () => {
    const supports = (plugins: ReturnType<typeof nativePlugins>) =>
      aCatalog(aProfile("cursor").withPlugins(plugins).build()).supportsUserScopeActivation(
        "cursor"
      );

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

    const named = aCatalog(aProfile("cursor").withPlugins(merging).build());
    const unnamed = aCatalog(aProfile("cursor").withPlugins(nativePlugins()).build());

    expect(named.projectHooksFileOf("cursor")).toBe(".fake/hooks.json");
    expect(named.projectHooksDeliveryOf("cursor")?.relativePath).toBe(".fake/hooks.json");
    expect(unnamed.projectHooksFileOf("cursor")).toBeUndefined();
    expect(unnamed.projectHooksDeliveryOf("cursor")).toBeNull();
  });

  it("names a user settings file only where activation declares one", () => {
    const userFile = (extra: Partial<NativeActivationSpec>) =>
      aCatalog(
        aProfile("cursor")
          .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
          .build()
      ).userMachineLocalFilesOf("cursor", "/home/me", NO_ENV);

    expect(userFile({})).toStrictEqual([]);
    expect(
      userFile({ userSettingsPath: (home, env) => `${home}/${env("X") ?? "settings.json"}` })
    ).toStrictEqual(["/home/me/settings.json"]);
  });

  it("keeps a machine-local file only where the settings name one", () => {
    const local = (path: string | null) =>
      aCatalog(
        aProfile("cursor")
          .withPlugins(
            nativePlugins({ marketplaceSettings: settingsAt(path), nativeActivation: activation() })
          )
          .build()
      ).machineLocalFilesOf("cursor");

    expect(local(".fake/settings.local.json")).toStrictEqual([".fake/settings.local.json"]);
    expect(local(null)).toStrictEqual([]);
  });

  it("keeps the project hooks file out of the machine-local files", () => {
    const merging = nativePlugins({
      hooksDestination: "project",
      projectHooksRelativePath: ".fake/hooks.json",
      projectHooksFormat: PROJECT_HOOKS_FORMAT,
    });

    const catalog = aCatalog(aProfile("cursor").withPlugins(merging).build());

    expect(catalog.machineLocalFilesOf("cursor")).not.toContain(".fake/hooks.json");
  });

  it("builds a flat profile flat, a native one as a marketplace, and an IDE one as a marketplace", () => {
    const catalog = aCatalog(
      aProfile("opencode").withPlugins(flatPlugins("refuses")).build(),
      aProfile("claude").withPlugins(nativePlugins()).build(),
      anIdeProfile()
    );

    expect(catalog.frameworkBuildModeFor("opencode")).toBe("flat");
    expect(catalog.frameworkBuildModeFor("claude")).toBe("marketplace");
    expect(catalog.frameworkBuildModeFor("vscode")).toBe("marketplace");
  });

  it("makes plugin enablement machine-global without scopeArgs, and not with them", () => {
    const withActivation = (extra: Partial<NativeActivationSpec>) =>
      aCatalog(
        aProfile("cursor")
          .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
          .build()
      );
    const scoped = { project: ["--local"], user: ["--user"] };

    expect(withActivation({}).pluginEnablementIsMachineGlobal("cursor")).toBe(true);
    expect(withActivation({ scopeArgs: scoped }).pluginEnablementIsMachineGlobal("cursor")).toBe(
      false
    );
  });

  it("counts an enabled host ref as in use, and a disabled one only where uninstall removes the ref", () => {
    const withActivation = (extra: Partial<NativeActivationSpec>) =>
      aCatalog(
        aProfile("cursor")
          .withPlugins(nativePlugins({ nativeActivation: activation(extra) }))
          .build()
      );

    expect(withActivation({ uninstallLeavesRefDisabled: true }).hostRefInUse("cursor", true)).toBe(
      true
    );
    expect(withActivation({}).hostRefInUse("cursor", false)).toBe(true);
    expect(withActivation({ uninstallLeavesRefDisabled: true }).hostRefInUse("cursor", false)).toBe(
      false
    );
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

    expect(
      aCatalog(aProfile("cursor").withPlugins(user).build()).copiesPluginFilesGlobally("cursor")
    ).toBe(true);
    expect(
      aCatalog(aProfile("cursor").withPlugins(nativePlugins()).build()).copiesPluginFilesGlobally(
        "cursor"
      )
    ).toBe(false);
  });

  it("hands back the build contract of a mode a profile declares, and none for an IDE profile", () => {
    const catalog = aCatalog(aProfile("claude").build(), anIdeProfile());

    expect(catalog.buildContractFor("claude", "flat")).toBeDefined();
    expect(catalog.buildContractFor("claude", "marketplace")).toBeUndefined();
    expect(catalog.buildContractFor("vscode", "flat")).toBeUndefined();
  });
});
