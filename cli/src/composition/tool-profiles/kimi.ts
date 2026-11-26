import { buildKimiFlatContract } from "../../contexts/tools/domain/behaviours/kimi/kimi-build.model.js";
import { descriptionOnlyRule } from "../../contexts/tools/domain/formats/rule-frontmatter.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { installUnder } from "../../contexts/tools/domain/profile/tool-suffix.js";
import { flatPlacement } from "../../contexts/tools/domain/sections/layout-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".kimi-code/";
const TOOL_SUFFIX = ".kimi.md";
/** Kimi's project MCP file: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html */
const MCP_PATH = `${DIRECTORY}mcp.json`;
/** Kimi documents guidance only in AGENTS.md, which lists the rules placed here:
 * https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents */
const INSTRUCTIONS = "instructions/";

/** Where a flat build puts Kimi's skills and agents. Skills are read from `.agents/skills/` (and
 * `.kimi-code/skills/`), agents from `.kimi-code/agents/` (and `.agents/agents/`), per
 * https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html and
 * https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents. The agent folder is
 * Kimi's own: `.agents/agents/` is Antigravity's, whose tool names Kimi does not know. */
const KIMI_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(DIRECTORY, {
  skillsDir: ".agents/skills/",
  skills: "single-level",
  rules: "top-level-no-frontmatter",
  rulesDir: `${DIRECTORY}${INSTRUCTIONS}`,
  agent: { ext: ".md" },
});

/** Each Claude tool an agent may declare, by the name Kimi gives it in an agent's `tools`, from
 * https://www.kimi.com/code/docs/en/kimi-code-cli/reference/tools.html. A tool with no name there,
 * such as NotebookEdit, is left out. */
const AGENT_TOOLS: ReadonlyMap<string, string> = new Map([
  ["Read", "Read"],
  ["Write", "Write"],
  ["Edit", "Edit"],
  ["Grep", "Grep"],
  ["Glob", "Glob"],
  ["Bash", "Bash"],
  ["WebFetch", "FetchURL"],
  ["WebSearch", "WebSearch"],
  ["Task", "Agent"],
  ["Agent", "Agent"],
  ["TodoWrite", "TodoList"],
  ["AskUserQuestion", "AskUserQuestion"],
  ["Skill", "Skill"],
  ["ExitPlanMode", "ExitPlanMode"],
  ["TaskOutput", "TaskOutput"],
  ["TaskStop", "TaskStop"],
]);

/** Kimi documents hooks only as `[[hooks]]` in the user-level `~/.kimi-code/config.toml`, with no
 * project-level hook file: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html */
const USER_LEVEL_ONLY =
  "Kimi reads hooks only from the user-level config.toml, never from a project";

export const kimi = defineAiTool({
  toolId: "kimi",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kimi Code CLI",
  signalDir: null,
  buildContracts: {
    flat: contract(buildKimiFlatContract, {
      layout: KIMI_FLAT_LAYOUT,
      mcpPath: MCP_PATH,
      agentTools: AGENT_TOOLS,
      hooksReason: USER_LEVEL_ONLY,
    }),
  },

  capabilities: {
    skills: { agentsSkillsDirectory: true },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, INSTRUCTIONS),
      convertFrontmatter: descriptionOnlyRule,
      listedInAgentsFile: true,
    },
    hooks: { delivery: { kind: "none", reason: USER_LEVEL_ONLY } },
    layout: flatPlacement({ namespacePrefix: "aidd-", artifacts: KIMI_FLAT_LAYOUT }),
  },

  linkSyntax: [],
});
