// biome-ignore lint/correctness/noUnresolvedImports: a source text the bundler inlines, never run here
import adapter from "../../../assets/hooks-runtime/host-kimi.cjs";
import type { NativeRegistrationSection } from "../../contexts/host-registration/contract/native-registration-spec.js";
import {
  buildKimiFlatContract,
  buildKimiPluginContract,
} from "../../contexts/tools/domain/behaviours/kimi/kimi-build.model.js";
import { declareHooks } from "../../contexts/tools/domain/formats/hooks/declaration.js";
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

// https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html
const USER_CONFIG_REASON =
  "Kimi reads hooks from the user config.toml or a local plugin, never from a project";

const hooks = declareHooks(
  { toolId: "kimi", directory: DIRECTORY, adapter },
  {
    // Only the events a plugin's hooks fired on Kimi, as captured, are delivered.
    undeclaredEvents: "skipped",
    manifestListsHooks: true,
    events: { SessionStart: "SessionStart", UserPromptSubmit: "UserPromptSubmit" },
  }
);

export const kimi = defineAiTool({
  toolId: "kimi",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kimi Code CLI",
  distributionProbes: { manifest: [".kimi-plugin/plugin.json"] },
  signalDir: null,
  buildContracts: {
    marketplace: contract(buildKimiPluginContract, { agentTools: AGENT_TOOLS, hooks }),
    flat: contract(buildKimiFlatContract, {
      layout: KIMI_FLAT_LAYOUT,
      mcpPath: MCP_PATH,
      agentTools: AGENT_TOOLS,
      hooksReason: USER_CONFIG_REASON,
    }),
  },

  capabilities: {
    skills: { agentsSkillsDirectory: true },
    rules: {
      buildInstallPath: installUnder(DIRECTORY, TOOL_SUFFIX, INSTRUCTIONS),
      convertFrontmatter: descriptionOnlyRule,
      listedInAgentsFile: KIMI_FLAT_LAYOUT,
    },
    hooks: { delivery: { kind: "none", reason: USER_CONFIG_REASON } },
    layout: flatPlacement({ namespacePrefix: "aidd-", artifacts: KIMI_FLAT_LAYOUT }),
  },

  linkSyntax: [],
});

/** Kimi has no plugin verbs: its `kimi web` server installs a local plugin directory, behind the token its banner prints: https://www.kimi.com/code/docs/en/kimi-code-cli/guides/web.html */
export const kimiNativeRegistration: NativeRegistrationSection = {
  pluginServer: {
    binary: "kimi",
    args: ["web", "--no-open", "--port", "0"],
    bannerPattern: "Local:\\s+(\\S+?)/?#token=(\\S+)",
    pluginsPath: "/api/v1/plugins",
    notInstalledCode: 40419,
  },
};
