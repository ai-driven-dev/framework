/** Copilot's flat build contract: direct workspace materialization. */

import {
  agentsIn,
  flatMcpFileArtifact,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type { ToolBuildContract } from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import type { AgentFrontmatter } from "../../formats/agents/agent-format.js";
import type { FlatHooksRoute, HooksRouting } from "../../formats/hooks/descriptor.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";

type FlatHooks = HooksRouting & { readonly flat: FlatHooksRoute };

export function buildCopilotFlatContract(
  hooks: FlatHooks,
  layout: FlatArtifactLayout,
  { mcpPath, frontmatter }: { readonly mcpPath: string; readonly frontmatter: AgentFrontmatter }
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
        // VS Code Copilot requires SKILL.md frontmatter name === parent folder name.
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        placement: agentsIn(layout),
        agentMarkdown: {
          frontmatter,
          pluginPrefixedName: true,
        },
      },
      mcp: flatMcpFileArtifact(mcpPath, "servers"),
      hooks: flatHooksArtifact(hooks, { tool: "copilot" }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
