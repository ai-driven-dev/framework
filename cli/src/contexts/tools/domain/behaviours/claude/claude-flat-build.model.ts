/** Claude's flat build contract: direct workspace materialization. */

import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { agentsIn, skillsIn } from "../../../contract/artifact-path.js";
import type { ToolBuildContract } from "../../../contract/build-contract.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { claudeAgentFrontmatter } from "./claude-agent.model.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildClaudeFlatContract(
  hooks: FlatHooks,
  layout: FlatArtifactLayout
): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        placement: skillsIn(layout),
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(layout),
        agentMarkdown: {
          frontmatter: (frontmatter) => claudeAgentFrontmatter(frontmatter),
          pluginPrefixedName: true,
        },
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        placement: { kind: "file", at: ".mcp.json" },
        mcpServersKey: "mcpServers",
      },
      hooks: flatHooksArtifact(hooks, { tool: "claude" }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
