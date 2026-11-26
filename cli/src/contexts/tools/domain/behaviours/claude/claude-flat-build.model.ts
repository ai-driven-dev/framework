/** Claude's flat build contract: direct workspace materialization. */

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

export function buildClaudeFlatContract(
  hooks: FlatHooks,
  layout: FlatArtifactLayout,
  frontmatter: AgentFrontmatter
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
          frontmatter,
          pluginPrefixedName: true,
        },
      },
      mcp: flatMcpFileArtifact(".mcp.json"),
      hooks: flatHooksArtifact(hooks, { tool: "claude" }),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
