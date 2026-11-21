/**
 * Copilot's build contracts: marketplace (OpenPlugin format) and flat (direct workspace
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
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { resolveDescription, resolveVersion } from "../../marketplace-catalog.js";
import { copilotAgentFrontmatter } from "./copilot-agent.model.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

const COPILOT_WORKSPACE_DIR = ".github/";

const OUTPUT_PLUGIN_MANIFEST_RELATIVE = ".plugin/plugin.json";

const OUTPUT_MARKETPLACE_RELATIVE = ".plugin/marketplace.json";

/** Output prefix for agents in flat mode: .github/agents/<plugin>/<name>.agent.md */
const FLAT_GITHUB_AGENTS_PREFIX = `${COPILOT_WORKSPACE_DIR}agents/`;

/** Output prefix for skills in flat mode: .github/skills/<plugin>/<name>/ */
const FLAT_GITHUB_SKILLS_PREFIX = `${COPILOT_WORKSPACE_DIR}skills/`;

const FLAT_VSCODE_MCP_PATH = ".vscode/mcp.json";

const FLAT_AGENT_OUTPUT_EXT = ".agent.md";

export function buildCopilotMarketplaceContract(hooks: HooksRouting): ToolBuildContract {
  return {
    ...pluginTreeContract(hooks, {
      manifestRelative: OUTPUT_PLUGIN_MANIFEST_RELATIVE,
      marketplaceRelative: OUTPUT_MARKETPLACE_RELATIVE,
      transformAgent: transformCopilotAgent,
    }),
    manifestSchemaName: null, // Copilot does not use AJV for the plugin manifest
    buildMarketplaceCatalog: async (source, entries, _fs) => ({
      catalog: {
        name: source.name,
        metadata: {
          description: source.description,
          version: source.version,
          pluginRoot: "./plugins",
        },
        owner: source.owner,
        plugins: entries,
      },
      schemaName: "marketplace",
      destRelPath: OUTPUT_MARKETPLACE_RELATIVE,
    }),
    buildMarketplaceEntry: async ({ name, outDir, srcEntry, fs }) => {
      const source = {
        fs,
        name,
        srcEntry,
        outDir,
        outputManifestRelative: OUTPUT_PLUGIN_MANIFEST_RELATIVE,
      };
      const version = await resolveVersion(source);
      const description = await resolveDescription(source);
      return { name, source: name, description, version };
    },
  };
}

function copilotFlatAgentPath(plugin: string, rel: string): string {
  return genericFlatAgentPath({
    agentsPrefix: FLAT_GITHUB_AGENTS_PREFIX,
    plugin,
    agentBaseName: rel.replace(/^agents\//, ""),
    outputExt: FLAT_AGENT_OUTPUT_EXT,
  });
}

function copilotFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(FLAT_GITHUB_SKILLS_PREFIX, plugin, rel.replace(/^skills\//, ""));
}

function transformCopilotAgent(content: string, _plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: `agents/${outName}`,
  });
  return serializeFrontmatter(copilotAgentFrontmatter(frontmatter), rewrittenBody);
}

function transformCopilotFlatAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const flatRelPath = copilotFlatAgentPath(plugin, outName);
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: flatRelPath,
    resolveTargetPath: (rel) => copilotFlatResolveTarget(plugin, rel),
  });
  const name = `${plugin}-${outName.replace(/\.md$/, "")}`;
  return serializeFrontmatter(copilotAgentFrontmatter({ ...frontmatter, name }), rewrittenBody);
}

const copilotFlatResolveTarget = flatTargetsOf(copilotFlatAgentPath, copilotFlatSkillPath);

export function buildCopilotFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: copilotFlatSkillPath,
        // VS Code Copilot requires SKILL.md frontmatter name === parent folder name.
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: copilotFlatAgentPath,
        transform: transformCopilotFlatAgent,
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        path: () => FLAT_VSCODE_MCP_PATH,
        merge: (existing, incoming, force) => mergeAdditiveMcp(existing, incoming, { force }),
        mcpServersKey: "servers",
        mergeDest: (outDir) => `${outDir}/${FLAT_VSCODE_MCP_PATH}`,
      },
      hooks: flatHooksArtifact(hooks, { tool: "copilot" }),
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
