/** Flat only. A skill sits one level under `.kiro/skills/`, its folder named as its `name`. */

import {
  agentsIn,
  rulesIn,
  skillsIn,
} from "../../../../../shared/domain/materialization/artifact-path.js";
import type {
  AgentMarkdown,
  ToolBuildContract,
} from "../../../../../shared/domain/materialization/build-contract.js";
import type { FlatArtifactLayout } from "../../../../../shared/domain/materialization/flat-paths.js";
import { flatHooksArtifact } from "../../formats/hooks/flat-routes.js";
import { inclusionModesRule } from "../../formats/rule-frontmatter.js";
import { type KiroHooks, mergeKiroHooks } from "./kiro-hooks.model.js";

export interface KiroFlatPaths {
  readonly layout: FlatArtifactLayout;
  readonly mcpPath: string;
}

export function buildKiroFlatContract(
  hooks: KiroHooks,
  { layout, mcpPath }: KiroFlatPaths,
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
      rules: {
        supported: true,
        source: { kind: "fullTree", srcDir: "rules" },
        placement: rulesIn(layout),
        ruleMarkdown: { frontmatter: inclusionModesRule, quote: "double" },
      },
      mcp: {
        supported: true,
        source: { kind: "configFile", srcPath: ".mcp.json" },
        placement: { kind: "file", at: mcpPath },
        mcpServersKey: "mcpServers",
      },
      hooks: flatHooksArtifact(hooks, { tool: "kiro" }, (existing, shipped) =>
        mergeKiroHooks(hooks, existing, shipped)
      ),
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
