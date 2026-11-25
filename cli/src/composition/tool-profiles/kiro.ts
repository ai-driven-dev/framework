import {
  buildKiroFlatContract,
  KIRO_UNDELIVERED,
} from "../../contexts/tools/domain/behaviours/kiro/kiro-build.model.js";
import { agentFrontmatterOf } from "../../contexts/tools/domain/formats/agents/agent-format.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { flatPlacement } from "../../contexts/tools/domain/sections/layout-section.js";
import type { AgentMarkdown } from "../../shared/domain/materialization/build-contract.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".kiro/";
const TOOL_SUFFIX = ".kiro.md";

/** An agent file may be Markdown with YAML front matter, its name derived from the filename when absent
 * and `*` meaning every tool (https://kiro.dev/docs/custom-agents/configuration-reference/). A Claude agent without a tool
 * list holds every tool, which Kiro spells `*`. Its `model` is left out: Kiro's ids are not
 * Claude's. */
const AGENT_FRONTMATTER = agentFrontmatterOf({
  keep: ["name", "description"],
  set: { tools: ["*"] },
});

const AGENT_MARKDOWN: AgentMarkdown = {
  frontmatter: AGENT_FRONTMATTER,
  pluginPrefixedName: true,
};

/** Skills and agents live under `.kiro/skills/` and `.kiro/agents/` (https://kiro.dev/docs/configuration/);
 * a skill's `name` must equal its folder (https://kiro.dev/docs/skills/), so the folder carries the plugin. */
const KIRO_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(DIRECTORY, {
  skills: "single-level",
  agent: { ext: ".md" },
});

export const kiro = defineAiTool({
  toolId: "kiro",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kiro",
  signalDir: null,
  buildContracts: {
    flat: contract(buildKiroFlatContract, KIRO_FLAT_LAYOUT, AGENT_MARKDOWN),
  },

  capabilities: {
    agents: { format: "markdown", frontmatter: AGENT_FRONTMATTER },
    skills: { directory: DIRECTORY },
    hooks: { delivery: KIRO_UNDELIVERED },
    layout: flatPlacement({ namespacePrefix: "aidd-", artifacts: KIRO_FLAT_LAYOUT }),
  },

  linkSyntax: [],
});
