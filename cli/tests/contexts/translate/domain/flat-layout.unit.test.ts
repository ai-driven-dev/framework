import { describe, expect, it } from "vitest";
import {
  flatAgentPath,
  flatHooksBridge,
  flatLinkTarget,
  flatPathOfPluginSuffix,
  sourceShipsHooksBridge,
} from "../../../../src/contexts/translate/domain/flat-layout.js";
import { skillsIn } from "../../../../src/shared/domain/materialization/artifact-path.js";
import type {
  ArtifactContract,
  ArtifactPlacement,
  FlatHooksBridge,
  ToolBuildContract,
} from "../../../../src/shared/domain/materialization/build-contract.js";
import { flatArtifactLayout } from "../../../../src/shared/domain/materialization/flat-paths.js";

const unsupported: ArtifactContract = { supported: false, reason: "off in this test" };

function supportedAs(placement: ArtifactPlacement): Extract<ArtifactContract, { supported: true }> {
  return { supported: true, source: { kind: "configFile", srcPath: "x" }, placement };
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
      ...artifacts,
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}

const AGENTS = supportedAs({ kind: "agentFiles", dir: "A/agents", ext: ".md" });
const SKILLS = supportedAs(
  skillsIn(flatArtifactLayout("S/", { skills: "nested", agent: { ext: ".md" } }))
);
const HOOKS = supportedAs({ kind: "hooks", scriptsDir: "H/hooks/" });

describe("naming the hooks bridge file", () => {
  const bridge: FlatHooksBridge = {
    skipIfSourceHas: "own.js",
    warning: (reason: string) => reason,
    dir: "bridge/",
    generate: (raw) => ({
      content: raw === "{}" ? null : `bridge of ${raw}`,
      warnings: ["host: unmapped event 'SessionEnd' skipped"],
    }),
  };

  it("names the bridge by plugin and carries what it generates, with what it leaves out", () => {
    expect(
      flatHooksBridge({ bridge, rawHooksJson: "[1]", pluginName: "p", sourceShipsItsOwn: false })
    ).toEqual({
      file: { relativePath: "bridge/p-hooks.js", content: "bridge of [1]" },
      warnings: ["host: unmapped event 'SessionEnd' skipped"],
    });
  });

  it("yields nothing, and tells nothing, when the source ships its own", () => {
    expect(
      flatHooksBridge({ bridge, rawHooksJson: "[1]", pluginName: "p", sourceShipsItsOwn: true })
    ).toEqual({ file: null, warnings: [] });
  });

  it("yields no file, yet tells what it leaves out, when no event maps to the bridge", () => {
    expect(
      flatHooksBridge({ bridge, rawHooksJson: "{}", pluginName: "p", sourceShipsItsOwn: false })
    ).toEqual({ file: null, warnings: ["host: unmapped event 'SessionEnd' skipped"] });
  });

  it("reads the hooks once for the file and what it leaves out", () => {
    let reads = 0;
    const counting: FlatHooksBridge = {
      ...bridge,
      generate: () => {
        reads += 1;
        return { content: "x", warnings: [] };
      },
    };

    flatHooksBridge({
      bridge: counting,
      rawHooksJson: "[1]",
      pluginName: "p",
      sourceShipsItsOwn: false,
    });

    expect(reads).toBe(1);
  });
});

describe("placing a flat agent", () => {
  it("drops the folders under agents/ so every nesting lands at one path", () => {
    expect(flatAgentPath(AGENTS, "p", "agents/team/a.md")).toBe("A/agents/a.md");
  });
});

describe("placing a path with the plugin suffix", () => {
  const contract = contractWith({ agents: AGENTS, skills: SKILLS, hooks: HOOKS });

  it.each([
    ["agents/team/a.md", "A/agents/a.md"],
    ["skills/x/SKILL.md", "S/skills/p/x/SKILL.md"],
    ["hooks/run.js", "H/hooks/p/run.js"],
    ["README.md", "README.md"],
  ])("moves %s to %s", (suffix, expected) => {
    expect(flatPathOfPluginSuffix(contract, suffix, "p")).toBe(expected);
  });

  it("leaves a path where it is when its artifact is unsupported", () => {
    expect(flatPathOfPluginSuffix(contractWith(), "skills/x/a.md", "p")).toBe("skills/x/a.md");
  });
});

describe("retargeting a link in a flat layout", () => {
  const contract = contractWith({ agents: AGENTS, skills: SKILLS, hooks: HOOKS });

  it("moves an agent and a skill, and nothing else", () => {
    const at = (pluginRelPath: string) => flatLinkTarget(contract, "p", pluginRelPath);
    expect(at("agents/team/a.md")).toBe("A/agents/a.md");
    expect(at("skills/x/SKILL.md")).toBe("S/skills/p/x/SKILL.md");
    expect(at("hooks/run.js")).toBe("hooks/run.js");
  });
});

describe("telling whether a source ships its hooks bridge", () => {
  const bridge: FlatHooksBridge = {
    skipIfSourceHas: "bridge.js",
    warning: (reason: string) => reason,
    dir: "bridge/",
    generate: () => ({ content: "generated", warnings: [] }),
  };

  it("finds the file by its name in any folder below hooks", () => {
    expect(sourceShipsHooksBridge([{ relativePath: "hooks/deep/inner/bridge.js" }], bridge)).toBe(
      true
    );
  });

  it("does not take a file that only ends like the bridge's name", () => {
    expect(sourceShipsHooksBridge([{ relativePath: "hooks/not-bridge.js" }], bridge)).toBe(false);
  });
});
