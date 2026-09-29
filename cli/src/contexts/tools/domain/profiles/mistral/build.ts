/**
 * Mistral's build contracts: marketplace (a native plugin tree) and flat (direct workspace
 * materialization). The transforms, path computations and catalog helpers are pure functions
 * reused from `domain/`; the contracts themselves are thin wiring.
 */

import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import {
  genericFlatAgentPath,
  genericFlatSkillPath,
} from "../../../../../kernel/materialization/flat-paths.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { MISTRAL_PLUGIN_ROOT_TOKEN } from "../../formats/plugin-root-token.js";
import {
  buildClaudeStyleEntry,
  buildClaudeStyleMarketplace,
  synthesizeClaudeStyleManifest,
  transformClaudeAgent,
} from "../../marketplace-catalog.js";
import {
  MISTRAL_HOOKS_SKIP_REASON,
  MISTRAL_MCP_PATH,
  OUTPUT_MISTRAL_MANIFEST_RELATIVE,
  OUTPUT_MISTRAL_MARKETPLACE_RELATIVE,
} from "./mistral-paths.js";
import { convertMistralSkillFrontmatter } from "./mistral-skill-frontmatter.js";

export function buildMistralContract(): ToolBuildContract {
  const manifestRelative = OUTPUT_MISTRAL_MANIFEST_RELATIVE;
  const marketplaceRelative = OUTPUT_MISTRAL_MARKETPLACE_RELATIVE;
  return {
    pluginRootToken: MISTRAL_PLUGIN_ROOT_TOKEN,
    manifestFileRelative: manifestRelative,
    synthesizeManifest: (source, presence) =>
      synthesizeClaudeStyleManifest(source, presence, {
        agentsField: true,
        hooksField: false,
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
      hooks: { supported: false, skipReason: MISTRAL_HOOKS_SKIP_REASON },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: buildClaudeStyleMarketplace(
        source as Parameters<typeof buildClaudeStyleMarketplace>[0],
        entries
      ),
      schemaName: "claude-marketplace",
      destRelPath: marketplaceRelative,
    }),
    buildMarketplaceEntry: async (name, _src, outDir, srcEntry, fs) =>
      buildClaudeStyleEntry(name, outDir, srcEntry, manifestRelative, fs),
  };
}

function mistralFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(".vibe/skills/", plugin, rel.replace(/^skills\//, ""));
}

// Vibe discovers a skill through its folder plus SKILL.md frontmatter; only the entry file
// carries the Vibe shape, so supporting files pass through untouched.
function transformMistralFlatSkill(content: string, _plugin: string, fileName: string): string {
  if (fileName !== "SKILL.md") return content;
  const { frontmatter, body } = parseFrontmatter(content);
  return serializeFrontmatter(convertMistralSkillFrontmatter(frontmatter), body);
}

export function buildMistralFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: mistralFlatSkillPath,
        transform: transformMistralFlatSkill,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: (plugin, rel) =>
          genericFlatAgentPath(".vibe/agents/", plugin, rel.replace(/^agents\//, ""), ".md"),
        transform: transformClaudeAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => MISTRAL_MCP_PATH,
      },
      hooks: { supported: false, skipReason: MISTRAL_HOOKS_SKIP_REASON },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
