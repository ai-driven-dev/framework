import { join } from "node:path";
import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CommandsCapability } from "../../capabilities/commands-capability.js";
import { CONFIG_MCP } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { flatGlobalFilePath, PluginsCapability } from "../../capabilities/plugins-capability.js";
import { RulesCapability } from "../../capabilities/rules-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
} from "../../formats/command.js";
import { flatHooksSupport } from "../../formats/hooks-descriptor.js";
import { toTypedMcpSection } from "../../formats/opencode-mcp-merge.js";
import { defineAiTool } from "../../profile/define-tool.js";
import { buildKiloFlatContract } from "./build.js";
import { KILO_HOOKS } from "./hooks.js";
import { kiloAgentFrontmatter } from "./kilo-agent.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.js";
import { KILO_DIRECTORY, KILO_OUTPUT_PATH_CANDIDATES } from "./kilo-paths.js";

const TOOL_SUFFIX = ".kilo.md";

export const kilo = defineAiTool({
  toolId: "kilo",
  distributionProbes: { marketplace: ["kilo.json"] },
  directory: KILO_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kilo Code",
  signalDir: ".kilo/commands",
  configOutputPaths: { "kilo.json": ".kilo/kilo.jsonc" },
  buildContracts: { flat: buildKiloFlatContract },

  capabilities: ({ directory, toolSuffix, installUnder }) => ({
    agents: new AgentsCapability({
      directory,
      toolSuffix,
      format: "markdown",
      frontmatter: kiloAgentFrontmatter,
    }),
    skills: new SkillsCapability({
      directory,
      toolSuffix,
      buildInstallPath: installUnder("skills/"),
      convertFrontmatter: (fm) => fm,
    }),
    commands: new CommandsCapability({
      directory,
      toolSuffix,
      buildInstallPath: (fileName) => buildAiddCommandFilePath(KILO_DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) =>
        convertCommandFrontmatterNoHint(fm, relativeFileName),
    }),
    rules: new RulesCapability({
      directory,
      toolSuffix,
      buildInstallPath: installUnder("rules/"),
      convertFrontmatter: (fm) =>
        fm.alwaysApply === false && fm.description !== undefined
          ? { description: fm.description }
          : {},
    }),
    mcp: new McpCapability({
      outputPath: "kilo.json",
      format: "json",
      entrySection: "mcp",
      mergeStrategy: "framework-prime",
      transformContent: toTypedMcpSection,
      consumes: [CONFIG_MCP],
      outputPathCandidates: KILO_OUTPUT_PATH_CANDIDATES,
    }),
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      globalFiles: {
        dir: (homedir) => join(homedir, ".config", "kilo"),
        map: flatGlobalFilePath(KILO_DIRECTORY),
      },
      ...flatHooksSupport(KILO_HOOKS, generateKiloHooksBridge),
    }),
  }),

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.kilo/commands/aidd/$2/$3"
    );
  },
});
