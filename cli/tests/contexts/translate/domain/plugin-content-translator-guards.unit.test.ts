import { describe, expect, it } from "vitest";
import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import { claude } from "../../../../src/contexts/tools/domain/profiles/claude/profile.js";
import { opencode } from "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { vscode } from "../../../../src/contexts/tools/domain/profiles/vscode/profile.js";
import { CommandsSection } from "../../../../src/contexts/tools/domain/sections/commands-section.js";
import { withSections } from "../../../helpers/ports/stub-ai-tool.js";
import { flatPlugins, nativePlugins } from "../../tools/testing/plugin-mode.js";
import { anEmptyContract, aProfile, PROJECT_HOOKS_FORMAT } from "../../tools/testing/profiles.js";
import {
  distOf,
  hooksDist,
  installedPathsOf,
  makeFile,
  skillDist,
  translator,
  treeOf,
} from "../testing/plugin-content-translator-kit.js";

const agents = [makeFile("agents/rev.md", "---\nname: rev\n---\n\nReview.\n")];
const agentDist = distOf([...agents], { agents });

const hostingAgents = (path: (plugin: string, rel: string) => string): ToolBuildContract =>
  anEmptyContract({
    artifacts: {
      ...anEmptyContract().artifacts,
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path,
      },
    },
  });

describe("a plugin component a target declares no section for", () => {
  it("is dropped by a native target without agents", () => {
    const tool = withSections(claude, { agents: null });
    expect(installedPathsOf(tool, agentDist)).toEqual([
      ".claude/plugins/sample-plugin/plugin.json",
    ]);
  });

  it("is dropped by a native target without skills", () => {
    const tool = withSections(claude, { skills: null });
    expect(installedPathsOf(tool, skillDist())).toEqual([
      ".claude/plugins/sample-plugin/plugin.json",
    ]);
  });

  it("is dropped by a flat target without skills", () => {
    expect(installedPathsOf(withSections(opencode, { skills: null }), skillDist())).toEqual([]);
  });
});

describe("an agent a flat target hosts without a section of its own", () => {
  const hosted = aProfile().withBuildContract(
    "flat",
    hostingAgents((plugin, rel) => `.fake/hosted/${plugin}-${rel}`)
  );

  it("is carried as the plugin wrote it when the contract rewrites nothing", () => {
    expect(treeOf(hosted.build(), agentDist)).toEqual({
      ".fake/hosted/sample-plugin-agents/rev.md": agents[0].content,
    });
  });

  it("is carried as the plugin wrote it, declared or not, by a contract that rewrites nothing", () => {
    const declared = withSections(hosted.build(), { agents: claude.section("agents") });
    expect(Object.keys(treeOf(declared, agentDist))).toEqual([
      ".fake/hosted/sample-plugin-agents/rev.md",
    ]);
  });

  it("is dropped by a contract that hosts no agent", () => {
    expect(treeOf(aProfile().build(), agentDist)).toEqual({});
  });

  it("is dropped by a target with no flat contract at all", () => {
    expect(treeOf(aProfile().withoutFlatContract().build(), agentDist)).toEqual({});
  });

  it("is installed by a target declaring the section but no flat contract", () => {
    const tool = withSections(aProfile().withoutFlatContract().build(), {
      agents: claude.section("agents"),
    });
    expect(Object.keys(treeOf(tool, agentDist))).toEqual([".fake/agents/sample-plugin/rev.md"]);
  });

  it("is installed by a target declaring the section and a contract that hosts no agent", () => {
    const tool = withSections(aProfile().build(), { agents: claude.section("agents") });
    expect(Object.keys(treeOf(tool, agentDist))).toEqual([".fake/agents/sample-plugin/rev.md"]);
  });
});

describe("a hooks manifest a native target keeps below the plugin root", () => {
  it("keeps every script below the manifest's own directory", () => {
    const tool = withSections(
      claude,
      nativePlugins({
        hooks: {
          kind: "project-merge",
          project: { relativePath: ".fake/hooks.json", format: PROJECT_HOOKS_FORMAT },
          pluginFile: "a/b/hooks.json",
        },
      })
    );
    expect(Object.keys(treeOf(tool, hooksDist())).sort()).toEqual([
      ".fake/plugins/sample-plugin/a/b/hooks.json",
      ".fake/plugins/sample-plugin/a/b/lib/check.sh",
    ]);
  });

  it("installs none for a target that runs no hook a plugin ships", () => {
    const tool = withSections(claude, nativePlugins({ hooks: { kind: "none", reason: "none" } }));
    expect(treeOf(tool, hooksDist())).toEqual({});
  });
});

describe("a hook a flat target cannot place", () => {
  it("installs none", () => {
    const tool = withSections(opencode, flatPlugins("refuses"));
    expect(installedPathsOf(tool, hooksDist())).toEqual([]);
  });
});

describe("the hook paths a flat install writes", () => {
  it("are none for a target that is no AI tool", () => {
    expect([...translator.flatHookPaths(hooksDist(), vscode)]).toEqual([]);
  });

  it("are none for an AI tool that takes no plugin", () => {
    const tool = aProfile().withPlugins(undefined).build();
    expect([...translator.flatHookPaths(hooksDist(), tool)]).toEqual([]);
  });
});

describe("a flat command nested in a directory", () => {
  it("is installed under its own file name", () => {
    const commands = [makeFile("commands/sub/deep/greet.md", "---\nname: greet\n---\n\nHi.\n")];
    expect(Object.keys(treeOf(opencode, distOf([...commands], { commands })))).toEqual([
      ".opencode/commands/sample-plugin/greet.md",
    ]);
  });
});

describe("a command a native target installs where the tool says", () => {
  const commands = [makeFile("commands/greet.md", "---\nname: greet\n---\n\nHi.\n")];
  const dist = distOf([...commands], { commands });
  const section = (installAt: (file: string) => string | null) =>
    new CommandsSection({
      directory: ".claude/",
      toolSuffix: ".md",
      buildInstallPath: installAt,
      convertFrontmatter: (fm) => fm,
    });

  it("is dropped when the tool installs it nowhere", () => {
    const tool = withSections(claude, { commands: section(() => null) });
    expect(installedPathsOf(tool, dist)).toEqual([".claude/plugins/sample-plugin/plugin.json"]);
  });

  it("is installed below the plugin without the tool's own namespace directory", () => {
    const tool = withSections(claude, {
      commands: section((file) => `.claude/commands/aidd/${file}`),
    });
    expect(installedPathsOf(tool, dist)).toContain(
      ".claude/plugins/sample-plugin/commands/greet.md"
    );
  });

  it("keeps a namespace directory that is not the first below the tool's own", () => {
    const tool = withSections(claude, {
      commands: section((file) => `.claude/deep/commands/aidd/${file}`),
    });
    expect(installedPathsOf(tool, dist)).toContain(
      ".claude/plugins/sample-plugin/deep/commands/aidd/greet.md"
    );
  });
});
