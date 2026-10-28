/** Antigravity's project distribution is flat and carries skills and hooks. A skill sits one level
 * under `.agents/skills/`, since `agy` expands none nested deeper. */

import { genericFlatSkillPath } from "../../../../../kernel/materialization/flat-paths.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { antigravityProjectHooksFormat } from "./antigravity-hooks.js";
import { ANTIGRAVITY_HOOKS_FILE, ANTIGRAVITY_SKILLS_DIR } from "./antigravity-paths.js";

function antigravityFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(ANTIGRAVITY_SKILLS_DIR, plugin, rel.replace(/^skills\//, ""));
}

export function buildAntigravityFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: antigravityFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: { supported: false },
      mcp: { supported: false },
      hooks: {
        supported: true,
        source: { kind: "hooksBundle", jsonPath: "hooks/hooks.json", scriptDir: "hooks" },
        path: antigravityProjectHooksFormat.scriptPath,
        hooksMerge: antigravityProjectHooksFormat.merge,
        hooksMergeDest: (outDir) => `${outDir}/${ANTIGRAVITY_HOOKS_FILE}`,
      },
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
