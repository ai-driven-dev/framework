import { describe, expect, it } from "vitest";
import { codexSpec } from "../../../../../../src/composition/tool-profiles/codex.js";
import { defineAiTool } from "../../../../../../src/contexts/tools/domain/profile/define-tool.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { artifactPath } from "../../../../../../src/shared/domain/materialization/artifact-path.js";
import type { ConfigArtifact } from "../../../../../../src/shared/domain/materialization/build-contract.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { sourceOf, supported } from "../../../testing/build-artifacts.builder.js";

const TOML = new SmolTomlCodec();
const codex = defineAiTool(codexSpec, { toml: TOML });

const HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

const _NO_CONTENT = {
  hasAgents: false,
  agentsList: [],
  skillsList: [],
  hasHooksJson: false,
  hasMcpJson: false,
};

function configArtifactOf(): ConfigArtifact {
  const step = present(codex.buildContracts.flat)().configArtifact;
  if (step === undefined) throw new Error("codex flat declares no config artifact");
  return step;
}

describe("building Codex's flat contract", () => {
  it("writes no manifest and no marketplace of its own", () => {
    const contract = present(codex.buildContracts.flat)();

    expect({
      manifestFileRelative: contract.manifestFileRelative,
      synthesizeManifest: contract.synthesizeManifest,
      manifestSchemaName: contract.manifestSchemaName,
      buildMarketplaceCatalog: contract.buildMarketplaceCatalog,
      buildMarketplaceEntry: contract.buildMarketplaceEntry,
    }).toStrictEqual({
      manifestFileRelative: null,
      synthesizeManifest: null,
      manifestSchemaName: null,
      buildMarketplaceCatalog: null,
      buildMarketplaceEntry: null,
    });
  });

  it("sources skills, agents and hooks from the plugin tree, and leaves mcp to the config artifact", () => {
    const { artifacts } = present(codex.buildContracts.flat)();

    expect({
      skills: sourceOf(artifacts.skills),
      agents: sourceOf(artifacts.agents),
      hooks: sourceOf(artifacts.hooks),
      mcp: artifacts.mcp,
    }).toStrictEqual({
      skills: { kind: "fullTree", srcDir: "skills" },
      agents: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      hooks: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
      mcp: {
        supported: false,
        reason: "carried by the config artifact (config.toml mcp_servers)",
      },
    });
  });

  it("nests a plugin's hook scripts under its own folder and merges its declaration into .codex/hooks.json", () => {
    const hooks = supported(present(codex.buildContracts.flat)().artifacts.hooks);

    expect({
      script: artifactPath(hooks, "aidd-dev", "hooks/journal.cjs"),
      file: hooks.hooksFile?.at,
      merged: hooks.hooksFile?.merge(null, {
        json: HOOKS_JSON,
        plugin: "aidd-dev",
        locate: (path) => path,
      }),
    }).toStrictEqual({
      script: ".codex/hooks/aidd-dev/journal.cjs",
      file: { shared: ".codex/hooks.json" },
      merged: {
        content: `${JSON.stringify(
          {
            hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
          },
          null,
          2
        )}\n`,
        warnings: [],
      },
    });
  });

  it("reads the project's own config.toml before writing it", () => {
    expect(configArtifactOf().reads(["aidd-dev"])).toStrictEqual([
      ".codex/config.toml",
      "AGENTS.md",
    ]);
    expect(configArtifactOf().probes(["aidd-dev"])).toStrictEqual([]);
    expect(configArtifactOf().assets).toStrictEqual({ tool: TOOL.codex, names: [] });
  });

  it("lists the rules its plugins placed in AGENTS.md beside the config.toml", () => {
    const files = configArtifactOf().emit({
      builtPlugins: ["aidd-dev"],
      pluginMcp: new Map(),
      rulesGlobs: [".codex/instructions/aidd-dev-*.md"],
      existing: new Map(),
      present: new Set(),
      assets: new Map(),
    });

    expect(files.map((file) => file.path)).toStrictEqual([".codex/config.toml", "AGENTS.md"]);
    expect(files[1].content).toContain("- `.codex/instructions/aidd-dev-*.md`");
  });

  it("writes one config.toml holding every built plugin's mcp servers, under its plugin prefix", () => {
    const files = configArtifactOf().emit({
      builtPlugins: ["aidd-dev", "aidd-pm"],
      pluginMcp: new Map([
        ["aidd-dev", JSON.stringify({ mcpServers: { "aidd-dev-context": { command: "node" } } })],
      ]),
      rulesGlobs: [],
      existing: new Map(),
      present: new Set(),
      assets: new Map(),
    });

    expect(files).toStrictEqual([
      {
        path: ".codex/config.toml",
        content:
          'project_doc_max_bytes = 262144\n\n[mcp_servers.aidd-dev-context]\ncommand = "node"\n\n[features]\nhooks = true\n',
      },
    ]);
  });

  it("keeps the project's own config.toml keys", () => {
    const files = configArtifactOf().emit({
      builtPlugins: [],
      pluginMcp: new Map(),
      rulesGlobs: [],
      existing: new Map([[".codex/config.toml", 'model = "o3"\n']]),
      present: new Set(),
      assets: new Map(),
    });

    expect(files[0]?.content).toContain('model = "o3"');
  });

  it("writes no mcp_servers table when no built plugin ships an mcp server", () => {
    const files = configArtifactOf().emit({
      builtPlugins: ["aidd-dev"],
      pluginMcp: new Map(),
      rulesGlobs: [],
      existing: new Map(),
      present: new Set(),
      assets: new Map(),
    });

    expect(files).toStrictEqual([
      {
        path: ".codex/config.toml",
        content: "project_doc_max_bytes = 262144\n\n[features]\nhooks = true\n",
      },
    ]);
  });
});
