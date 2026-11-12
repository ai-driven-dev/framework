import { describe, expect, it } from "vitest";
import type { ProjectHooksFormat } from "../../../../../src/contexts/tools/contract/tool-vocabulary.js";
import { pluginAnswers } from "../../../../../src/contexts/tools/domain/profile/plugin-answers.js";
import { nativeLayout } from "../../../../../src/contexts/tools/domain/sections/layout-section.js";
import {
  answersOf,
  flatOf,
  flatPlugins,
  nativeOf,
  nativePlugins,
  unsupportedPlugins,
} from "../../testing/plugin-mode.js";

const projectHooksFormat: ProjectHooksFormat = {
  merge: () => ({ content: "", warnings: [] }),
  unmerge: () => "",
  contributedEntries: () => [],
  isEmpty: () => true,
  scriptPath: () => "",
  scriptDir: () => "",
};

const projectMerge = {
  kind: "project-merge",
  project: { relativePath: ".x/hooks.json", format: projectHooksFormat },
} as const;

describe("what a flat tool answers", () => {
  const answers = flatOf(answersOf(flatPlugins("accepts")));

  it("accepts hooks without a reason, and lands them in the plugin", () => {
    expect([answers.hooksAcceptance(), answers.deliversHooksToProject()]).toStrictEqual([
      { accepts: true },
      false,
    ]);
  });

  it("names no loader entry unless it declares one", () => {
    expect(answers.flatLayout().hooksLoaderEntry).toBeNull();
  });

  it("takes a fresh install at project scope, and copies the built tree", () => {
    expect([answers.requiresUserScope(), answers.materializesFromBuiltTree()]).toEqual([
      false,
      true,
    ]);
  });

  it("delivers its hooks to the project when it merges them there", () => {
    const merging = answersOf(
      flatPlugins({ ...projectMerge, flat: { dir: ".x/hooks/" } }, "aidd-")
    );

    expect(merging.deliversHooksToProject()).toBe(true);
  });
});

describe("what a native tool answers", () => {
  it("builds as neutral native until its manifest says marketplace", () => {
    expect(nativeOf(answersOf(nativePlugins())).translatesAsMarketplace()).toBe(false);
    expect(
      nativeOf(
        answersOf(nativePlugins({ translationMode: "marketplace" }))
      ).translatesAsMarketplace()
    ).toBe(true);
  });

  it("delivers no mcp, lands hooks in the plugin, and names a plugin's directory", () => {
    const answers = nativeOf(answersOf(nativePlugins({ pluginsDir: ".x/plugins/" })));

    expect([
      answers.mcpFile().accepts,
      answers.deliversHooksToProject(),
      answers.pluginOutputDir("p"),
      answers.hooksFilePath(),
    ]).toStrictEqual([false, false, ".x/plugins/p/", "hooks/hooks.json"]);
  });

  it("answers a declared user directory even when the scope is project", () => {
    const answers = answersOf(nativePlugins({ userPluginsDir: (home) => `${home}/.x/plugins` }));

    expect(nativeOf(answers).requiresUserScope()).toBe(false);
    expect(answers.userPluginsBaseDir("/home/me")).toBe("/home/me/.x/plugins");
  });

  it("answers no user directory for a layout declaring none", () => {
    expect(answersOf(nativePlugins()).userPluginsBaseDir("/home/me")).toBeNull();
  });

  it("materializes from the built tree only at user scope", () => {
    const user = nativePlugins({ installScope: "user", userPluginsDir: (home) => `${home}/.x` });

    expect(answersOf(user).materializesFromBuiltTree()).toBe(true);
    expect(answersOf(nativePlugins()).materializesFromBuiltTree()).toBe(false);
  });

  it("carries a trust notice and leaves the hooks file to the plugin", () => {
    const answers = nativeOf(
      answersOf(nativePlugins({ hooks: { kind: "plugin-file", trustNotice: "trust it" } }))
    );

    expect([answers.trustNotice(), answers.hooksFilePath()]).toEqual([
      "trust it",
      "hooks/hooks.json",
    ]);
  });

  it("names the plugin's own hooks file when it merges the rest into the project", () => {
    const answers = nativeOf(
      answersOf(nativePlugins({ hooks: { ...projectMerge, pluginFile: "hooks/own.json" } }))
    );

    expect([answers.deliversHooksToProject(), answers.hooksFilePath()]).toEqual([
      true,
      "hooks/own.json",
    ]);
  });

  it("refuses a native layout with no manifest", () => {
    const { layout, hooks } = nativePlugins();

    expect(() => pluginAnswers(layout, null, hooks, null)).toThrow(
      "a native layout requires a manifest."
    );
  });
});

describe("what any tool answers about hooks it does not run", () => {
  it("states the reason, for a native tool, a flat one and one taking no plugin", () => {
    const none = { kind: "none", reason: "runs no plugin hooks" } as const;
    const refusing = { accepts: false, reason: "runs no plugin hooks" };

    expect([
      answersOf(nativePlugins({ hooks: none })).hooksAcceptance(),
      answersOf(flatPlugins(none)).hooksAcceptance(),
      answersOf(unsupportedPlugins("runs no plugin hooks")).hooksAcceptance(),
    ]).toStrictEqual([refusing, refusing, refusing]);
  });

  it("takes no plugin, delivers nothing and builds from no tree when it hosts none", () => {
    const answers = answersOf(unsupportedPlugins());

    expect([
      answers.kind,
      answers.deliversHooksToProject(),
      answers.materializesFromBuiltTree(),
    ]).toStrictEqual(["unsupported", false, false]);
  });
});

describe("a layout composed by hand", () => {
  it("answers the user directory its global files map to when no user resolver exists", () => {
    const globalFiles = { dir: (home: string) => `${home}/.g`, map: () => null };
    const answers = pluginAnswers(
      nativeLayout({ pluginsDir: ".x/", globalFiles }),
      nativePlugins().manifest,
      nativePlugins().hooks,
      null
    );

    expect([answers.userPluginsBaseDir("/h"), answers.copiesFilesGlobally()]).toEqual([
      "/h/.g",
      true,
    ]);
  });
});
