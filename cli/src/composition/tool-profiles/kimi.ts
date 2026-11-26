import type { NativeRegistrationSection } from "../../contexts/host-registration/contract/native-registration-spec.js";
import {
  buildKimiFlatContract,
  buildKimiPluginContract,
} from "../../contexts/tools/domain/behaviours/kimi/kimi-build.model.js";
import { contract } from "../../contexts/tools/domain/profile/contract-builders.js";
import { defineAiTool } from "../../contexts/tools/domain/profile/define-tool.js";
import { flatPlacement } from "../../contexts/tools/domain/sections/layout-section.js";
import {
  type FlatArtifactLayout,
  flatArtifactLayout,
} from "../../shared/domain/materialization/flat-paths.js";

const DIRECTORY = ".kimi-code/";
const TOOL_SUFFIX = ".kimi.md";
/** Kimi's project MCP file: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html */
const MCP_PATH = `${DIRECTORY}mcp.json`;

/** Where a flat build puts Kimi's skills and agents. Skills are read from `.agents/skills/` (and
 * `.kimi-code/skills/`), agents from `.kimi-code/agents/` (and `.agents/agents/`), per
 * https://www.kimi.com/code/docs/en/kimi-code-cli/customization/skills.html and
 * https://www.kimi.com/code/docs/en/kimi-code-cli/customization/agents. The agent folder is
 * Kimi's own: `.agents/agents/` is Antigravity's, whose tool names Kimi does not know. */
const KIMI_FLAT_LAYOUT: FlatArtifactLayout = flatArtifactLayout(DIRECTORY, {
  skillsDir: ".agents/skills/",
  skills: "single-level",
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

/** Kimi reads hooks from the user config.toml or a local plugin, never a project: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html */
const USER_CONFIG_REASON =
  "Kimi reads hooks from the user config.toml or a local plugin, never from a project, and a plugin's hooks are not delivered until a payload is captured";

export const kimi = defineAiTool({
  toolId: "kimi",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kimi Code CLI",
  distributionProbes: { manifest: [".kimi-plugin/plugin.json"] },
  signalDir: null,
  buildContracts: {
    marketplace: contract(buildKimiPluginContract, {
      agentTools: AGENT_TOOLS,
      hooksReason: USER_CONFIG_REASON,
    }),
    flat: contract(buildKimiFlatContract, {
      layout: KIMI_FLAT_LAYOUT,
      mcpPath: MCP_PATH,
      agentTools: AGENT_TOOLS,
      hooksReason: USER_CONFIG_REASON,
    }),
  },

  capabilities: {
    skills: { agentsSkillsDirectory: true },
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
