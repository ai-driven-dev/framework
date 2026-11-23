import { describe, expect, it } from "vitest";
import { artifactPath } from "../../../../../../src/contexts/tools/contract/artifact-path.js";
import type { ConfigArtifact } from "../../../../../../src/contexts/tools/contract/build-contract.js";
import { codexProfile } from "../../../../../../src/contexts/tools/domain/profiles/codex/codex.profile.js";
import { SmolTomlCodec } from "../../../../../../src/contexts/tools/infrastructure/smol-toml-codec.adapter.js";
import { reshapeFrontmatter } from "../../../../../../src/shared/domain/markdown.js";
import { parsePluginName } from "../../../../../../src/shared/domain/plugin/plugin-name.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { present } from "../../../../../shared/testing/present.builder.js";
import { supported } from "../../../testing/build-artifacts.builder.js";

const TOML = new SmolTomlCodec();
const codex = codexProfile(TOML);

const _HOOKS_JSON = JSON.stringify({
  hooks: { Stop: [{ hooks: [{ type: "command", command: "node journal.cjs" }] }] },
});

const NO_CONTENT = {
  hasAgents: false,
  agentsList: [],
  skillsList: [],
  hasHooksJson: false,
  hasMcpJson: false,
};

function _configArtifactOf(): ConfigArtifact {
  const step = present(codex.buildContracts.flat)().configArtifact;
  if (step === undefined) throw new Error("codex flat declares no config artifact");
  return step;
}

describe("building Codex's marketplace contract", () => {
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
      skill: artifactPath(supported(artifacts.skills), "aidd-dev", "skills/01-plan/SKILL.md"),
      agent: artifactPath(supported(artifacts.agents), "aidd-dev", "agents/planner.md"),
      mcp: artifactPath(supported(artifacts.mcp), "aidd-dev", ".mcp.json"),
      hook: artifactPath(supported(artifacts.hooks), "aidd-dev", "hooks/journal.cjs"),
    }).toStrictEqual({
      skill: "skills/01-plan/SKILL.md",
      agent: "codex-agents/planner.toml",
      mcp: ".mcp.json",
      hook: "hooks/journal.cjs",
    });
  });

  it("keeps only the three frontmatter fields Codex reads in a skill", () => {
    const { skillFrontmatter } = supported(
      present(codex.buildContracts.marketplace)().artifacts.skills
    );

    expect(
      reshapeFrontmatter("---\nname: plan\ndescription: Plan it\nmodel: opus\n---\nBody.\n", {
        frontmatter: (fm) => skillFrontmatter?.(fm) ?? fm,
      })
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
      srcEntry: { name: parsePluginName("aidd-dev") },
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
