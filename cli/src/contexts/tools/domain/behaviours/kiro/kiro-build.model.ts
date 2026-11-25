/** Flat only. A skill sits one level under `.kiro/skills/`, its folder named as its `name`. */

import { agentsIn, skillsIn } from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import type { NoDelivery } from "../../sections/hooks-section.js";

/** Kiro documents a hook file and a SessionStart trigger (https://kiro.dev/docs/hooks/), but no
 * payload was captured here, so no host adapter is written and no plugin hook is delivered. */
export const KIRO_UNDELIVERED: NoDelivery = {
  kind: "none",
  reason: "no Kiro hook payload was captured, so no host adapter is written",
};

export function buildKiroFlatContract(
  layout: FlatArtifactLayout,
  agentMarkdown: AgentMarkdown
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
        agentMarkdown,
      },
      mcp: { supported: false, reason: "no plugin ships MCP servers to merge" },
      hooks: { supported: false, reason: "no host adapter: no Kiro payload was captured" },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
