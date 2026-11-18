import { describe, expect, it } from "vitest";
import type { ToolBuildContract } from "../../../../src/contexts/tools/contract/build-contract.js";
import { anEmptyContract } from "../../../shared/testing/empty-build-contract.js";
import { contractToolProfile } from "../testing/contract-tool-profile.js";
import { flatPluginsStub } from "../testing/flat-plugins-stub.js";
import { markdownSectionInstalling } from "../testing/markdown-section-stub.js";
import { nativePluginsStub } from "../testing/native-plugins-stub.js";
import {
  distOf,
  hooksDist,
  installedPathsOf,
  makeFile,
  skillDist,
  translator,
  treeOf,
} from "../testing/plugin-content-translator-kit.js";
import { claude, opencode, vscode } from "../testing/registered-profiles.js";
import { syntheticToolProfile } from "../testing/synthetic-tool-profile.js";

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
    const tool = contractToolProfile(claude, { sections: { agents: null } });
    expect(installedPathsOf(tool, agentDist)).toEqual([
      ".claude/plugins/sample-plugin/plugin.json",
    ]);
  });

  it("is dropped by a native target without skills", () => {
    const tool = contractToolProfile(claude, { sections: { skills: null } });
    expect(installedPathsOf(tool, skillDist())).toEqual([
      ".claude/plugins/sample-plugin/plugin.json",
    ]);
  });

  it("is dropped by a flat target without skills", () => {
    expect(
      installedPathsOf(contractToolProfile(opencode, { sections: { skills: null } }), skillDist())
    ).toEqual([]);
  });
});

describe("an agent a flat target hosts without a section of its own", () => {
  const hostsAgents = hostingAgents((plugin, rel) => `.fake/hosted/${plugin}-${rel}`);
  const declaringAgents = { agents: markdownSectionInstalling() };

  it("is carried as the plugin wrote it when the contract rewrites nothing", () => {
    expect(treeOf(syntheticToolProfile({ flatContract: hostsAgents }), agentDist)).toEqual({
      ".fake/hosted/sample-plugin-agents/rev.md": agents[0].content,
    });
  });

  it("is carried as the plugin wrote it, declared or not, by a contract that rewrites nothing", () => {
    const declared = syntheticToolProfile({
      flatContract: hostsAgents,
      sections: declaringAgents,
    });
    expect(Object.keys(treeOf(declared, agentDist))).toEqual([
      ".fake/hosted/sample-plugin-agents/rev.md",
    ]);
  });

  it("is dropped by a contract that hosts no agent", () => {
    expect(treeOf(syntheticToolProfile(), agentDist)).toEqual({});
  });

  it("is dropped by a target with no flat contract at all", () => {
    expect(treeOf(syntheticToolProfile({ flatContract: null }), agentDist)).toEqual({});
  });

  it("is installed by a target declaring the section but no flat contract", () => {
    const tool = syntheticToolProfile({ flatContract: null, sections: declaringAgents });
    expect(Object.keys(treeOf(tool, agentDist))).toEqual([".fake/agents/sample-plugin/rev.md"]);
  });

  it("is installed by a target declaring the section and a contract that hosts no agent", () => {
    const tool = syntheticToolProfile({ sections: declaringAgents });
    expect(Object.keys(treeOf(tool, agentDist))).toEqual([".fake/agents/sample-plugin/rev.md"]);
  });
});

describe("a hooks manifest a native target keeps below the plugin root", () => {
  it("keeps every script below the manifest's own directory", () => {
    const tool = contractToolProfile(claude, {
      plugins: nativePluginsStub({ hooksFile: "a/b/hooks.json" }),
    });
    expect(Object.keys(treeOf(tool, hooksDist())).sort()).toEqual([
      ".fake/plugins/sample-plugin/a/b/hooks.json",
      ".fake/plugins/sample-plugin/a/b/lib/check.sh",
    ]);
  });

  it("installs none for a target that runs no hook a plugin ships", () => {
    const tool = contractToolProfile(claude, {
      plugins: nativePluginsStub({ hooks: { accepts: false, reason: "none" } }),
    });
    expect(treeOf(tool, hooksDist())).toEqual({});
  });
});

describe("a hook a flat target cannot place", () => {
  it("installs none", () => {
    const tool = contractToolProfile(opencode, { plugins: flatPluginsStub() });
    expect(installedPathsOf(tool, hooksDist())).toEqual([]);
  });
});

describe("the hook paths a flat install writes", () => {
  it("are none for a target that is no AI tool", () => {
    expect([...translator.flatHookPaths(hooksDist(), vscode)]).toEqual([]);
  });

  it("are none for an AI tool that takes no plugin", () => {
    const tool = syntheticToolProfile({ plugins: null });
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
  it("is dropped when the tool installs it nowhere", () => {
    const tool = contractToolProfile(claude, {
      sections: { commands: markdownSectionInstalling(() => null) },
    });
    expect(installedPathsOf(tool, dist)).toEqual([".claude/plugins/sample-plugin/plugin.json"]);
  });

  it("is installed below the plugin without the tool's own namespace directory", () => {
    const tool = contractToolProfile(claude, {
      sections: { commands: markdownSectionInstalling((file) => `.claude/commands/aidd/${file}`) },
    });
    expect(installedPathsOf(tool, dist)).toContain(
      ".claude/plugins/sample-plugin/commands/greet.md"
    );
  });

  it("keeps a namespace directory that is not the first below the tool's own", () => {
    const tool = contractToolProfile(claude, {
      sections: {
        commands: markdownSectionInstalling((file) => `.claude/deep/commands/aidd/${file}`),
      },
    });
    expect(installedPathsOf(tool, dist)).toContain(
      ".claude/plugins/sample-plugin/deep/commands/aidd/greet.md"
    );
  });
});
