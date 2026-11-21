/**
 * Claude's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../shared/domain/markdown.js";
import {
  genericFlatAgentPath,
  genericFlatSkillPath,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import { mergeAdditiveMcp } from "../../formats/additive-mcp-merge.js";
import { flatTargetsOf } from "../../formats/flat-targets.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeHooksArtifact } from "../../formats/hooks/routes.js";
import {
  buildSharedEntry,
  buildSharedMarketplace,
  synthesizeSharedManifest,
} from "../../marketplace-catalog.js";
import { claudeAgentFrontmatter } from "./claude-agent.model.js";

/** Build output paths, deliberately distinct from the source-side constants even where the
 * literal values coincide: a change to either side must not collapse them. */
const OUTPUT_CLAUDE_MANIFEST_RELATIVE = ".claude-plugin/plugin.json";
const OUTPUT_CLAUDE_MARKETPLACE_RELATIVE = ".claude-plugin/marketplace.json";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildClaudeContract(hooks: HooksRouting): ToolBuildContract {
  const namesHooks = hooks.manifestNamesHooks === true;
  const manifestRelative = OUTPUT_CLAUDE_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_CLAUDE_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: hooks.rootToken,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: (source, presence) =>
      synthesizeSharedManifest(source, presence, {
        agentsField: true,
        hooksField: namesHooks,
      }),
    manifestSchemaName: "plugin-manifest",
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: (_p, rel) => rel,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: (_p, rel) => rel,
        transform: transformClaudeAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".mcp.json",
      },
      hooks: pluginTreeHooksArtifact(hooks),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildSharedMarketplace(
        source as Parameters<typeof buildSharedMarketplace>[0],
        entries
      ),
      schemaName: "claude-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async ({ name, outDir, srcEntry, fs }) =>
      buildSharedEntry({ fs, name, srcEntry, outDir, outputManifestRelative: manifestRelative }),
  };
}

function claudeFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: ".claude/agents/",
    plugin,
    agentBaseName: rel.slice("agents/".length),
    outputExt: ".md",
  });
}

function claudeFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(".claude/skills/", plugin, rel.slice("skills/".length));
}

function transformClaudeAgent(content: string, _plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: `agents/${outName}`,
  });
  return serializeFrontmatter(claudeAgentFrontmatter(frontmatter), rewrittenBody);
}

const claudeFlatResolveTarget = flatTargetsOf(claudeFlatAgentPath, claudeFlatSkillPath);

function transformClaudeFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = claudeFlatAgentPath(plugin, `agents/${outName}`);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => claudeFlatResolveTarget(plugin, rel),
  });
  const name = `${plugin}-${outName.replace(/\.md$/, "")}`;
  return serializeFrontmatter(claudeAgentFrontmatter({ ...frontmatter, name }), rewrittenBody);
}

export function buildClaudeFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: claudeFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: claudeFlatAgentPath,
        transform: transformClaudeFlatAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => ".mcp.json",
        merge: (existing, incoming, force) =>
          mergeAdditiveMcp(existing, incoming, { force, serversKey: "mcpServers" }),
        mcpServersKey: "mcpServers",
        mergeDest: (outDir) => `${outDir}/.mcp.json`,
      },
      hooks: flatHooksArtifact(hooks, { tool: "claude" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
