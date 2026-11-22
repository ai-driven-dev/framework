/**
 * Codex's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization); what they merge, strip and list lives in the sibling models.
 */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { agentsIn, skillsIn } from "../../../contract/artifact-path.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeHooksArtifact } from "../../formats/hooks/routes.js";
import type { TomlCodec } from "../../formats/toml.js";
import { tomlAgentMarkdownToToml } from "../../formats/toml-agent.js";
import { mergeCodexConfigToml } from "./codex-config.model.js";
import {
  buildCodexManifest,
  buildCodexMarketplace,
  buildCodexMarketplaceEntry,
} from "./codex-marketplace.model.js";
import {
  OUTPUT_CODEX_AGENTS_DIR,
  OUTPUT_CODEX_MANIFEST_RELATIVE,
  OUTPUT_CODEX_MARKETPLACE_RELATIVE,
} from "./codex-paths.model.js";
import { stripCodexSkillFrontmatter } from "./codex-skill.model.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

function codexPluginArtifacts(
  toml: TomlCodec,
  hooks: HooksRouting
): ToolBuildContract["artifacts"] {
  return {
    skills: {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      placement: { kind: "relative" },
      skillFrontmatter: stripCodexSkillFrontmatter,
    },
    agents: {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      placement: { kind: "agentFiles", dir: OUTPUT_CODEX_AGENTS_DIR, ext: ".toml" },
      transform: tomlAgentMarkdownToToml(toml),
    },
    mcp: {
      supported: true,
      source: { kind: "configFile", srcPath: ".mcp.json" },
      placement: { kind: "file", at: ".mcp.json" },
    },
    hooks: pluginTreeHooksArtifact(hooks),
    rules: { supported: false },
    commands: { supported: false },
  };
}

export function buildCodexContract(toml: TomlCodec, hooks: HooksRouting): ToolBuildContract {
  const manifestRelative = OUTPUT_CODEX_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CODEX_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: buildCodexManifest,
    manifestSchemaName: "codex-plugin-manifest",
    artifacts: codexPluginArtifacts(toml, hooks),
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildCodexMarketplace(
        source as Parameters<typeof buildCodexMarketplace>[0],
        entries
      ),
      schemaName: "codex-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, srcEntry }) =>
      buildCodexMarketplaceEntry(name, srcEntry as Record<string, unknown> | undefined),
  };
}

// Codex scans `.agents/skills/` (cwd to repo root) for workspace skills, the documented project
// skill root; verified live, a SKILL.md there appears in Codex's "Available skills" context.
// `.codex/skills/` also resolves but is undocumented, so the documented root is what is used.
const CODEX_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(".codex/", {
  skillsDir: ".agents/skills/",
  skills: "single-level",
  agent: { ext: ".toml" },
});

function collectMcpServers(
  builtPlugins: readonly string[],
  pluginMcp: ReadonlyMap<string, string>
): Record<string, unknown> {
  const mcpServers: Record<string, unknown> = {};
  for (const plugin of builtPlugins) {
    const raw = pluginMcp.get(plugin);
    if (raw === undefined) continue;
    const parsed = JSON.parse(raw) as { mcpServers?: Record<string, unknown> };
    for (const [k, v] of Object.entries(parsed.mcpServers ?? {})) {
      mcpServers[k] = v;
    }
  }
  return mcpServers;
}

const CODEX_FLAT_CONFIG = ".codex/config.toml";

function buildCodexConfigPayload(toml: TomlCodec, mcpServers: Record<string, unknown>): string {
  if (Object.keys(mcpServers).length === 0) return "";
  return toml.stringify({ mcp_servers: mcpServers });
}

function codexFlatArtifacts(toml: TomlCodec, hooks: FlatHooks): ToolBuildContract["artifacts"] {
  return {
    skills: {
      supported: true,
      source: { kind: "fullTree", srcDir: "skills" },
      placement: skillsIn(CODEX_FLAT_LAYOUT),
      rewriteSkillName: true,
    },
    agents: {
      supported: true,
      source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
      placement: agentsIn(CODEX_FLAT_LAYOUT),
      transform: tomlAgentMarkdownToToml(toml),
    },
    mcp: { supported: false }, // handled by configArtifact (config.toml mcp_servers)
    hooks: flatHooksArtifact(hooks, { tool: "codex" }),
    rules: { supported: false },
    commands: { supported: false },
  };
}

export function buildCodexFlatContract(toml: TomlCodec, hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: codexFlatArtifacts(toml, hooks),
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
    configArtifact: {
      reads: () => [CODEX_FLAT_CONFIG],
      probes: () => [],
      assets: { tool: "codex", names: [] },
      emit: ({ builtPlugins, pluginMcp, existing }) => {
        const mcpServers = collectMcpServers(builtPlugins, pluginMcp);
        const aiddPayload = buildCodexConfigPayload(toml, mcpServers);
        const merged = mergeCodexConfigToml(toml)(
          existing.get(CODEX_FLAT_CONFIG) ?? "",
          aiddPayload
        );
        return [{ path: CODEX_FLAT_CONFIG, content: merged }];
      },
    },
  };
}
