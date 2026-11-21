import { describe, expect, it } from "vitest";
import type { ConfigArtifact } from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { codexProfile } from "../../../../../../src/contexts/tools/domain/profiles/codex/codex.profile.js";
import {
  buildCodexMarketplace,
  buildCodexMarketplaceEntry,
} from "../../../../../../src/contexts/tools/domain/profiles/codex/codex-build.model.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { sourceOf, supported } from "../../../testing/build-artifacts.builder.js";

const TOML = new SmolTomlCodec();
const codex = codexProfile(TOML);

const HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

const NO_CONTENT = {
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

describe("present(codex.buildContracts.marketplace)()", () => {
  it("declares Codex's own plugin manifest path, schema and root token", () => {
    const contract = present(codex.buildContracts.marketplace)();

    expect({
      pluginRootToken: contract.pluginRootToken,
      manifestFileRelative: contract.manifestFileRelative,
      manifestSchemaName: contract.manifestSchemaName,
    }).toStrictEqual({
      pluginRootToken: "$" + "{PLUGIN_ROOT}",
      manifestFileRelative: ".codex-plugin/plugin.json",
      manifestSchemaName: "codex-plugin-manifest",
    });
  });

  it("synthesizes a manifest pointing skills at one directory, and naming no agents", () => {
    const manifest = present(codex.buildContracts.marketplace)().synthesizeManifest?.(
      {
        name: "aidd-dev",
        description: "Development loop",
        version: "1.2.3",
        license: "MIT",
        keywords: ["aidd"],
      },
      {
        hasAgents: true,
        agentsList: ["planner.md"],
        skillsList: ["01-plan"],
        hasHooksJson: true,
        hasMcpJson: true,
      }
    );

    expect(manifest).toStrictEqual({
      name: "aidd-dev",
      description: "Development loop",
      version: "1.2.3",
      license: "MIT",
      keywords: ["aidd"],
      skills: "./skills",
      hooks: "./hooks/hooks.json",
      mcpServers: "./.mcp.json",
    });
  });

  it("omits from the manifest every field the source plugin never declared", () => {
    const manifest = present(codex.buildContracts.marketplace)().synthesizeManifest?.(
      { name: "aidd-dev" },
      {
        hasAgents: false,
        agentsList: [],
        skillsList: [],
        hasHooksJson: false,
        hasMcpJson: false,
      }
    );

    expect(manifest).toStrictEqual({ name: "aidd-dev" });
  });

  it("copies an author given as a plain name into the manifest", () => {
    const manifest = present(codex.buildContracts.marketplace)().synthesizeManifest?.(
      { name: "aidd-dev", author: "AIDD" },
      NO_CONTENT
    );

    expect(manifest).toStrictEqual({ name: "aidd-dev", author: "AIDD" });
  });

  it("copies an author given as an object into the manifest", () => {
    const manifest = present(codex.buildContracts.marketplace)().synthesizeManifest?.(
      { name: "aidd-dev", author: { name: "AIDD", email: "team@example.test" } },
      NO_CONTENT
    );

    expect(manifest).toStrictEqual({
      name: "aidd-dev",
      author: { name: "AIDD", email: "team@example.test" },
    });
  });

  it("stages an agent as TOML beside the plugin tree and leaves every other artifact where it was", () => {
    const { artifacts } = present(codex.buildContracts.marketplace)();

    expect({
      skill: supported(artifacts.skills).path("aidd-dev", "skills/01-plan/SKILL.md"),
      agent: supported(artifacts.agents).path("aidd-dev", "agents/planner.md"),
      mcp: supported(artifacts.mcp).path("aidd-dev", ".mcp.json"),
      hook: supported(artifacts.hooks).path("aidd-dev", "hooks/journal.cjs"),
    }).toStrictEqual({
      skill: "skills/01-plan/SKILL.md",
      agent: "codex-agents/planner.toml",
      mcp: ".mcp.json",
      hook: "hooks/journal.cjs",
    });
  });

  it("keeps only the three frontmatter fields Codex reads in a skill", () => {
    const transform = supported(
      present(codex.buildContracts.marketplace)().artifacts.skills
    ).transform;

    expect(
      transform?.(
        "---\nname: plan\ndescription: Plan it\nmodel: opus\n---\nBody.\n",
        "aidd-dev",
        "SKILL.md"
      )
    ).toBe("---\nname: 'plan'\ndescription: 'Plan it'\n---\nBody.\n");
  });

  it("builds the catalog Codex discovers, at .agents/plugins/marketplace.json", async () => {
    const built = await present(codex.buildContracts.marketplace)().buildMarketplaceCatalog?.(
      { name: "aidd", displayName: "AI Driven Dev", plugins: [] },
      [{ name: "aidd-dev" }],
      new InMemoryFileAdapter()
    );

    expect(built).toStrictEqual({
      catalog: {
        name: "aidd",
        interface: { displayName: "AI Driven Dev" },
        plugins: [{ name: "aidd-dev" }],
      },
      schemaName: "codex-marketplace",
      destRelPath: ".agents/plugins/marketplace.json",
    });
  });

  it("builds a catalog entry carrying the installation, authentication and category Codex requires", async () => {
    const entry = await present(codex.buildContracts.marketplace)().buildMarketplaceEntry?.({
      name: "aidd-dev",
      pluginSrc: "/src/plugins/aidd-dev",
      outDir: "/out",
      srcEntry: { name: "aidd-dev" },
      fs: new InMemoryFileAdapter(),
    });

    expect(entry).toStrictEqual({
      name: "aidd-dev",
      source: { source: "local", path: "./plugins/aidd-dev" },
      policy: { installation: "AVAILABLE", authentication: "ON_USE" },
      category: "Developer Tools",
    });
  });
});

describe("present(codex.buildContracts.flat)()", () => {
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
      rules: artifacts.rules,
      commands: artifacts.commands,
    }).toStrictEqual({
      skills: { kind: "fullTree", srcDir: "skills" },
      agents: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      hooks: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
      mcp: { supported: false },
      rules: { supported: false },
      commands: { supported: false },
    });
  });

  it("nests a plugin's hook scripts under its own folder and merges its declaration into .codex/hooks.json", () => {
    const hooks = supported(present(codex.buildContracts.flat)().artifacts.hooks);

    expect({
      script: hooks.path("aidd-dev", "hooks/journal.cjs"),
      file: [hooks.hooksFile?.path("aidd-dev"), hooks.hooksFile?.shared],
      merged: hooks.hooksFile?.merge(null, {
        json: HOOKS_JSON,
        plugin: "aidd-dev",
        locate: (path) => path,
      }),
    }).toStrictEqual({
      script: ".codex/hooks/aidd-dev/journal.cjs",
      file: [".codex/hooks.json", true],
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
    expect(configArtifactOf().reads(["aidd-dev"])).toStrictEqual([".codex/config.toml"]);
    expect(configArtifactOf().probes(["aidd-dev"])).toStrictEqual([]);
    expect(configArtifactOf().assets).toStrictEqual({ tool: TOOL.codex, names: [] });
  });

  it("writes one config.toml holding every built plugin's mcp servers, under its plugin prefix", () => {
    const files = configArtifactOf().emit({
      builtPlugins: ["aidd-dev", "aidd-pm"],
      pluginMcp: new Map([
        ["aidd-dev", JSON.stringify({ mcpServers: { context: { command: "node" } } })],
      ]),
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

describe("a Codex marketplace catalog", () => {
  it("falls back to the marketplace name as its display name", () => {
    expect(buildCodexMarketplace({ name: "m" }, [])).toStrictEqual({
      name: "m",
      interface: { displayName: "m" },
      plugins: [],
    });
    expect(buildCodexMarketplace({ name: "m", displayName: "Mine" }, []).interface).toStrictEqual({
      displayName: "Mine",
    });
  });

  it("defaults an entry's authentication and category, and takes a string override for each", () => {
    expect(buildCodexMarketplaceEntry("p", undefined)).toStrictEqual({
      name: "p",
      source: { source: "local", path: "./plugins/p" },
      policy: { installation: "AVAILABLE", authentication: "ON_USE" },
      category: "Developer Tools",
    });
    expect(
      buildCodexMarketplaceEntry("p", { authentication: "NEVER", category: "Testing" })
    ).toMatchObject({
      policy: { installation: "AVAILABLE", authentication: "NEVER" },
      category: "Testing",
    });
    expect(buildCodexMarketplaceEntry("p", { authentication: 1, category: null })).toMatchObject({
      policy: { authentication: "ON_USE" },
      category: "Developer Tools",
    });
  });
});
