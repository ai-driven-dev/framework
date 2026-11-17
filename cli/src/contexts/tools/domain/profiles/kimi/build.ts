/** Flat only. A skill sits one level under `.kimi-code/skills/` as `<plugin>-<skill>/`, so its
 * `name`, Kimi's handle, carries the plugin. Kimi skips, with only a log warning, an agent whose
 * `name` is not kebab-case or whose `description` is missing, so both stop the build instead. */

import { InvalidAgentFrontmatterError } from "../../../../../kernel/errors.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../../kernel/markdown.js";
import { genericFlatSkillPath } from "../../../../../kernel/materialization/flat-paths.js";
import { rewriteRelativeLinks } from "../../../../../kernel/materialization/relative-link-rewrite.js";
import type { ToolBuildContract } from "../../build-contract.js";
import { NO_HOOKS_ARTIFACT } from "../../formats/hooks-descriptor.js";
import { portableAgentFrontmatter } from "../../formats/portable-agent.js";
import { KIMI_AGENTS_DIR, KIMI_SKILLS_DIR } from "./kimi-paths.js";

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** One file per agent, nested source folders folded into its kebab-case name. */
function agentName(plugin: string, rel: string): string {
  const leaf = rel.replace(/^agents\//, "").replace(/(\.agent)?\.md$/, "");
  return `${plugin}-${leaf.replaceAll("/", "-")}`;
}

function kimiFlatAgentPath(plugin: string, rel: string): string {
  return `${KIMI_AGENTS_DIR}${agentName(plugin, rel)}.md`;
}

function kimiFlatSkillPath(plugin: string, rel: string): string {
  return genericFlatSkillPath(KIMI_SKILLS_DIR, plugin, rel.replace(/^skills\//, ""));
}

function resolveTarget(plugin: string, rel: string): string {
  if (rel.startsWith("agents/")) return kimiFlatAgentPath(plugin, rel);
  if (rel.startsWith("skills/")) return kimiFlatSkillPath(plugin, rel);
  return rel;
}

function transformKimiAgent(content: string, plugin: string, outName: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const rel = `agents/${outName}`;
  const name = agentName(plugin, rel);
  if (!KEBAB_CASE.test(name)) {
    throw new InvalidAgentFrontmatterError(name, "name is not kebab-case");
  }
  const rewrittenBody = rewriteRelativeLinks(body, {
    currentFilePluginRelative: kimiFlatAgentPath(plugin, rel),
    resolveTargetPath: (target) => resolveTarget(plugin, target),
  });
  return serializeFrontmatter(portableAgentFrontmatter(frontmatter, name), rewrittenBody);
}

export function buildKimiFlatContract(): ToolBuildContract {
  return {
    manifestFileRelative: null,
    synthesizeManifest: null,
    manifestSchemaName: null,
    artifacts: {
      skills: {
        supported: true,
        source: { kind: "fullTree", srcDir: "skills" },
        path: kimiFlatSkillPath,
        rewriteSkillName: true,
      },
      agents: {
        supported: true,
        source: { kind: "filteredTree", srcDir: "agents", inputExt: ".md" },
        path: kimiFlatAgentPath,
        transform: transformKimiAgent,
      },
      mcp: { supported: false },
      hooks: NO_HOOKS_ARTIFACT,
      rules: { supported: false },
      commands: { supported: false },
    },
    buildMarketplaceCatalog: null,
    buildMarketplaceEntry: null,
  };
}
