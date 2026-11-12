import { describe, expect, it } from "vitest";
import { claude } from "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { codex } from "../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import { cursor } from "../../../../src/contexts/tools/domain/profiles/cursor/profile.js";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { withSections } from "../../../helpers/ports/stub-ai-tool.js";
import { flatPlugins } from "../../tools/testing/plugin-mode.js";
import {
  CLAUDE_ROOT_TOKEN,
  CODEX_ROOT_TOKEN,
  claudeManifestContent,
  distOf,
  hookScriptContent,
  hooksDist,
  hooksManifestFor,
  installedPathsOf,
  makeFile,
  skillActionContent,
  skillAssetContent,
  skillDist,
  skillEntryContent,
  translator,
  treeOf,
} from "../testing/plugin-content-translator-kit.js";

describe("a plugin of one skill, its action and its asset", () => {
  it("lays the whole skill tree under the plugin directory claude expands, beside the manifest", () => {
    expect(installedPathsOf(claude, skillDist())).toEqual([
      ".claude/plugins/sample-plugin/plugin.json",
      ".claude/plugins/sample-plugin/skills/hello/SKILL.md",
      ".claude/plugins/sample-plugin/skills/hello/actions/run.md",
      ".claude/plugins/sample-plugin/skills/hello/reference.json",
    ]);
  });

  it("carries the skill's asset byte for byte, its plugin-root variable untranslated", () => {
    const tree = treeOf(codex, skillDist());
    expect(tree[".codex/plugins/sample-plugin/skills/hello/reference.json"]).toBe(
      skillAssetContent
    );
  });

  it("lays the tree at the project root, and no manifest, for a target whose plugins have no directory of their own", () => {
    expect(installedPathsOf(cursor, skillDist())).toEqual([
      "sample-plugin/skills/hello/SKILL.md",
      "sample-plugin/skills/hello/actions/run.md",
      "sample-plugin/skills/hello/reference.json",
    ]);
  });

  it("namespaces every skill file per plugin, prose and asset alike, for a flat target", () => {
    expect(treeOf(opencode, skillDist())).toEqual({
      ".opencode/skills/sample-plugin/hello/SKILL.md": skillEntryContent,
      ".opencode/skills/sample-plugin/hello/actions/run.md": skillActionContent,
      ".opencode/skills/sample-plugin/hello/reference.json": skillAssetContent,
    });
  });
});

describe("a plugin's hooks", () => {
  it("puts the manifest where codex reads it, rewrites its plugin root, and keeps each script's own bytes", () => {
    expect(treeOf(codex, hooksDist())).toEqual({
      ".codex/plugins/sample-plugin/hooks/hooks.json": hooksManifestFor(CODEX_ROOT_TOKEN),
      ".codex/plugins/sample-plugin/hooks/lib/check.sh": hookScriptContent,
      ".codex/plugins/sample-plugin/plugin.json": claudeManifestContent,
    });
  });

  it("delivers a flat target's scripts per plugin and no manifest", () => {
    expect(treeOf(opencode, hooksDist())).toEqual({
      ".opencode/hooks/sample-plugin/lib/check.sh": hookScriptContent,
    });
  });

  it("renames the loader's own module to the plugin, carrying its bytes", () => {
    const loaderModule = "export const plugin = () => {};\n";
    const tree = treeOf(opencode, hooksDist([makeFile("hooks/opencode-plugin.js", loaderModule)]));
    expect(tree).toEqual({
      ".opencode/hooks/sample-plugin/lib/check.sh": hookScriptContent,
      ".opencode/plugin/sample-plugin.js": loaderModule,
    });
  });
});

describe("a flat target that rewrites what it hosts", () => {
  const rewriting = {
    ...opencode,
    rewriteContent: (content: string) => content.replace("SOURCE", "REWRITTEN"),
  };

  it("rewrites a skill's prose and carries its asset as it is", () => {
    const skills = [
      makeFile("skills/hello/SKILL.md", "Read SOURCE.\n"),
      makeFile("skills/hello/reference.json", '{ "from": "SOURCE" }\n'),
    ];
    expect(treeOf(rewriting, distOf([...skills], { skills }))).toEqual({
      ".opencode/skills/sample-plugin/hello/SKILL.md": "Read REWRITTEN.\n",
      ".opencode/skills/sample-plugin/hello/reference.json": '{ "from": "SOURCE" }\n',
    });
  });
});

describe("a flat target whose loader is triggered by a generated bridge", () => {
  const bridged = withSections(
    opencode,
    flatPlugins(
      {
        kind: "bridge",
        flat: {
          dir: ".stub/hooks/",
          bridge: {
            generate: (raw: string, plugin: string) =>
              raw.includes("PreToolUse") ? `bridge(${plugin}):${raw}` : null,
            path: (plugin: string) => `.stub/plugin/${plugin}.js`,
            skipIfSourceHas: "own-plugin.js",
          },
        },
      },
      "aidd-"
    )
  );

  it("generates the bridge from the plugin's own hooks manifest", () => {
    expect(treeOf(bridged, hooksDist())).toEqual({
      ".stub/hooks/sample-plugin/lib/check.sh": hookScriptContent,
      ".stub/plugin/sample-plugin.js": `bridge(sample-plugin):${hooksManifestFor(CLAUDE_ROOT_TOKEN)}`,
    });
  });

  it("generates none for a plugin shipping its own", () => {
    const withOwn = hooksDist([
      makeFile("hooks/own-plugin.js", "export const plugin = () => {};\n"),
    ]);
    expect(Object.keys(treeOf(bridged, withOwn)).sort()).toEqual([
      ".stub/hooks/sample-plugin/lib/check.sh",
      ".stub/hooks/sample-plugin/own-plugin.js",
    ]);
  });

  it("names the hook paths it writes, the generated bridge among them", () => {
    expect([...translator.flatHookPaths(hooksDist(), bridged)].sort()).toEqual([
      ".stub/hooks/sample-plugin/lib/check.sh",
      ".stub/plugin/sample-plugin.js",
    ]);
  });

  it("names no bridge path for a plugin shipping its own", () => {
    const own = hooksDist([makeFile("hooks/own-plugin.js", "export const plugin = () => {};\n")]);

    expect([...translator.flatHookPaths(own, bridged)].sort()).toEqual([
      ".stub/hooks/sample-plugin/lib/check.sh",
      ".stub/hooks/sample-plugin/own-plugin.js",
    ]);
  });

  it("names no hook path for a tool that is not flat", () => {
    expect(translator.flatHookPaths(hooksDist(), claude).size).toBe(0);
  });

  it("generates none where the manifest names nothing the bridge maps", () => {
    const hooks = [
      makeFile("hooks/hooks.json", '{ "hooks": {} }'),
      makeFile("hooks/lib/check.sh", hookScriptContent),
    ];
    expect(treeOf(bridged, distOf([...hooks], { hooks }))).toEqual({
      ".stub/hooks/sample-plugin/lib/check.sh": hookScriptContent,
    });
  });

  it("generates none for a plugin shipping no hooks manifest at all", () => {
    const hooks = [makeFile("hooks/lib/check.sh", hookScriptContent)];
    expect(treeOf(bridged, distOf([...hooks], { hooks }))).toEqual({
      ".stub/hooks/sample-plugin/lib/check.sh": hookScriptContent,
    });
  });
});
