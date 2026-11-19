import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CONFIG_MCP } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import type { AiTool, HasAgents, HasMcp, HasPlugins, HasSkills } from "../../contracts.js";
import { stripToolSuffix } from "../../formats/command.js";
import { flatHooksSupport, flatProjectHooksDelivery } from "../../formats/hooks-descriptor.js";
import { registerTool } from "../../registry.js";
import { buildKiroFlatContract } from "./build.js";
import { KIRO_HOOKS } from "./hooks.js";
import { kiroAgentFrontmatter, kiroAgentJson } from "./kiro-agent.js";
import {
  isKiroHooksFileEmpty,
  kiroHookEntries,
  kiroHooksScriptDir,
  kiroHooksScriptPath,
  mergeKiroHooks,
  unmergeKiroHooks,
} from "./kiro-hooks.js";
import { KIRO_AGENTS_DIR, KIRO_DIRECTORY, KIRO_MCP_PATH, KIRO_SKILLS_DIR } from "./kiro-paths.js";

const TOOL_SUFFIX = ".kiro.md";

function agentInstallPath(fileName: string): string {
  const base = fileName.split("/").at(-1) ?? fileName;
  return `${KIRO_AGENTS_DIR}${stripToolSuffix(TOOL_SUFFIX, base).replace(/\.md$/, "")}.json`;
}

/** No commands: skills are Kiro's slash commands. No rules: steering files are another format. */
export const kiro: AiTool<HasAgents & HasSkills & HasMcp & HasPlugins> = {
  kind: "ai",
  toolId: "kiro",
  directory: KIRO_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kiro",
  signalDir: null,
  buildContracts: { flat: buildKiroFlatContract },

  capabilities: {
    agents: new AgentsCapability({
      directory: KIRO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      format: "markdown",
      frontmatter: kiroAgentFrontmatter,
      serialize: kiroAgentJson,
      buildInstallPath: agentInstallPath,
    }),
    skills: new SkillsCapability({
      directory: KIRO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => `${KIRO_SKILLS_DIR}${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      convertFrontmatter: (fm) => fm,
    }),
    mcp: new McpCapability({
      outputPath: KIRO_MCP_PATH,
      format: "json",
      entrySection: "mcpServers",
      consumes: [CONFIG_MCP],
    }),
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      flatSkillLayout: "single-level",
      ...flatHooksSupport(KIRO_HOOKS),
      ...flatProjectHooksDelivery(KIRO_HOOKS.flat, {
        merge: mergeKiroHooks,
        unmerge: unmergeKiroHooks,
        contributedEntries: kiroHookEntries,
        isEmpty: isKiroHooksFileEmpty,
        scriptPath: kiroHooksScriptPath,
        scriptDir: kiroHooksScriptDir,
      }),
    }),
  },

  rewriteContent(content: string): string {
    return content;
  },
};

registerTool(kiro);
