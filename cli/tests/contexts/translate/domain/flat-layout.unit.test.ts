import { describe, expect, it } from "vitest";
import type {
  ArtifactContract,
  FlatHooksBridge,
  ToolBuildContract,
} from "../../../../src/contexts/tools/contract/build-contract.js";
import {
  flatAgentPath,
  flatHooksBridgeFile,
  flatLinkTarget,
  flatPathOfPluginSuffix,
} from "../../../../src/contexts/translate/domain/flat-layout.js";

const unsupported: ArtifactContract = { supported: false };

function supportedAt(folder: string): Extract<ArtifactContract, { supported: true }> {
  return {
    supported: true,
    source: { kind: "configFile", srcPath: folder },
    path: (plugin, relPath) => `${folder}/${plugin}-${relPath}`,
  };
}

function contractWith(artifacts: Partial<ToolBuildContract["artifacts"]> = {}): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: unsupported,
      agents: unsupported,
      mcp: unsupported,
      hooks: unsupported,
      rules: unsupported,
      commands: unsupported,
      ...artifacts,
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}

const AGENTS = supportedAt("A");
const SKILLS = supportedAt("S");
const HOOKS = supportedAt("H");

describe("flatHooksBridgeFile", () => {
  const bridge: FlatHooksBridge = {
    skipIfSourceHas: "own.js",
    path: (plugin) => `bridge/${plugin}.js`,
    generate: (raw) => (raw === "{}" ? null : `bridge of ${raw}`),
  };

  it("names the bridge by plugin and carries what it generates", () => {
    expect(
      flatHooksBridgeFile({
        bridge,
        rawHooksJson: "[1]",
        pluginName: "p",
        sourceShipsItsOwn: false,
      })
    ).toEqual({ relativePath: "bridge/p.js", content: "bridge of [1]" });
  });

  it("yields nothing when the source ships its own", () => {
    expect(
      flatHooksBridgeFile({
        bridge,
        rawHooksJson: "[1]",
        pluginName: "p",
        sourceShipsItsOwn: true,
      })
    ).toBeNull();
  });

  it("yields nothing when no event maps to the bridge", () => {
    expect(
      flatHooksBridgeFile({
        bridge,
        rawHooksJson: "{}",
        pluginName: "p",
        sourceShipsItsOwn: false,
      })
    ).toBeNull();
  });
});

describe("flatAgentPath", () => {
  it("drops the folders under agents/ so every nesting lands at one path", () => {
    expect(flatAgentPath(AGENTS, "p", "agents/team/a.md")).toBe("A/p-agents/a.md");
  });
});

describe("flatPathOfPluginSuffix", () => {
  const contract = contractWith({ agents: AGENTS, skills: SKILLS, hooks: HOOKS });

  it.each([
    ["agents/team/a.md", "A/p-agents/a.md"],
    ["skills/x/SKILL.md", "S/p-skills/x/SKILL.md"],
    ["hooks/run.js", "H/p-hooks/run.js"],
    ["README.md", "README.md"],
  ])("moves %s to %s", (suffix, expected) => {
    expect(flatPathOfPluginSuffix(contract, suffix, "p")).toBe(expected);
  });

  it("leaves a path where it is when its artifact is unsupported", () => {
    expect(flatPathOfPluginSuffix(contractWith(), "skills/x/a.md", "p")).toBe("skills/x/a.md");
  });
});

describe("flatLinkTarget", () => {
  const contract = contractWith({ agents: AGENTS, skills: SKILLS, hooks: HOOKS });

  it("moves an agent and a skill, and nothing else", () => {
    const at = (pluginRelPath: string) => flatLinkTarget(contract, "p", pluginRelPath);
    expect(at("agents/team/a.md")).toBe("A/p-agents/a.md");
    expect(at("skills/x/SKILL.md")).toBe("S/p-skills/x/SKILL.md");
    expect(at("hooks/run.js")).toBe("hooks/run.js");
  });
});
