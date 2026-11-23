import { describe, expect, it } from "vitest";
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

describe("what a profile's plugins capability says about activation", () => {
  it("names no project hooks file and no user scope without a plugins capability", () => {
    const profile = aProfile(TOOL.cursor).withPlugins(undefined).build();

    expect(profile.projectHooksDelivery()).toBeNull();
    expect(profile.supportsUserScopeActivation()).toBe(false);
    expect(profile.plugins()).toBeNull();
  });

  it("supports a user scope through a user-scope install directory, and not otherwise", () => {
    const supports = (plugins: PluginSet) =>
      aProfile(TOOL.cursor).withPlugins(plugins).build().supportsUserScopeActivation();

    expect(supports(nativePlugins())).toBe(false);
    expect(supports(nativePlugins({ installScope: "user", userPluginsDir: "{home}/.x" }))).toBe(
      true
    );
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

  it("builds a flat profile flat and a native one as a marketplace", () => {
    expect(
      aProfile(TOOL.opencode).withPlugins(flatPlugins("refuses")).build().frameworkBuildMode()
    ).toBe("flat");
    expect(aProfile(TOOL.claude).withPlugins(nativePlugins()).build().frameworkBuildMode()).toBe(
      "marketplace"
    );
  });

  it("copies plugin files globally only for a user-scope install", () => {
    const user = nativePlugins({ installScope: "user", userPluginsDir: "{home}/.x" });

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

describe("a profile that declares no plugin layout and no mcp", () => {
  const bare = defineAiTool(aiSpec);

  it("builds as a marketplace and shares no flat plugin mcp", () => {
    expect(bare.frameworkBuildMode()).toBe("marketplace");
    expect([bare.mcpConfig(), bare.flatPluginMcp()]).toStrictEqual([null, null]);
  });

  it("places and owns a native tool's skills as nested ones", () => {
    const native = defineAiTool({ ...aiSpec, capabilities: sectionsOf(nativePlugins()) });

    expect(native.ownsFlatPath(".x/skills/p/plan/SKILL.md", "p")).toBe(true);
    expect(native.ownsFlatPath(".x/skills/p-plan/SKILL.md", "p")).toBe(false);
  });
});
