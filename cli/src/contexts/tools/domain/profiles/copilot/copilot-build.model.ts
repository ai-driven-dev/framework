/**
 * Copilot's build contracts: marketplace (OpenPlugin format) and flat (direct workspace
 * materialization). The transforms, path computations and merges are pure functions reused from
 * `domain/formats/`; the contracts themselves are thin wiring.
 */

import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentMarkdown, ToolBuildContract } from "../../../contract/build-contract.js";
import { mergeAdditiveMcp } from "../../formats/additive-mcp-merge.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { pluginTreeContract } from "../../formats/plugin-tree-contract.js";
import { resolveDescription, resolveVersion } from "../../marketplace-catalog.js";
import { copilotAgentFrontmatter } from "./copilot-agent.model.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

const COPILOT_WORKSPACE_DIR = ".github/";

const OUTPUT_PLUGIN_MANIFEST_RELATIVE = ".plugin/plugin.json";

const OUTPUT_MARKETPLACE_RELATIVE = ".plugin/marketplace.json";

const FLAT_VSCODE_MCP_PATH = ".vscode/mcp.json";

/** Where a flat build puts copilot's skills and agents: `.github/agents/<plugin>-<name>.agent.md`. */
const COPILOT_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(COPILOT_WORKSPACE_DIR, {
  skills: "single-level",
  agent: { ext: ".agent.md" },
});

export function buildCopilotMarketplaceContract(hooks: HooksRouting): ToolBuildContract {
  return {
    ...pluginTreeContract(hooks, {
      manifestRelative: OUTPUT_PLUGIN_MANIFEST_RELATIVE,
      marketplaceRelative: OUTPUT_MARKETPLACE_RELATIVE,
      agentMarkdown: copilotAgentMarkdown,
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

const copilotAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => copilotAgentFrontmatter(frontmatter),
};

const copilotFlatAgentMarkdown: AgentMarkdown = {
  frontmatter: (frontmatter) => copilotAgentFrontmatter(frontmatter),
  pluginPrefixedName: true,
};

export function buildCopilotFlatContract(hooks: FlatHooks): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        layout: COPILOT_FLAT_LAYOUT,
        // VS Code Copilot requires SKILL.md frontmatter name === parent folder name.
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        layout: COPILOT_FLAT_LAYOUT,
        agentMarkdown: copilotFlatAgentMarkdown,
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
