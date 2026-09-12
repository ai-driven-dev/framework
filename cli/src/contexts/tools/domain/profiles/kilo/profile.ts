import { join } from "node:path";
import { KiloDualConfigError } from "../../../../../kernel/errors.js";
import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CommandsCapability } from "../../capabilities/commands-capability.js";
import { CONFIG_MCP } from "../../capabilities/config-refs.js";
import { McpCapability } from "../../capabilities/mcp-capability.js";
import { PluginsCapability } from "../../capabilities/plugins-capability.js";
import { RulesCapability } from "../../capabilities/rules-capability.js";
import { SkillsCapability } from "../../capabilities/skills-capability.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasMcp,
  HasPlugins,
  HasRules,
  HasSkills,
} from "../../contracts.js";
import {
  buildAiddCommandFilePath,
  convertCommandFrontmatterNoHint,
  stripToolSuffix,
} from "../../formats/command.js";
import { registerTool } from "../../registry.js";
import { transformMcpToOpencode } from "../opencode/build.js";
import { buildKiloFlatContract } from "./build.js";
import { generateKiloHooksBridge } from "./kilo-hooks-bridge.js";
import {
  KILO_DIRECTORY,
  KILO_HOOKS_DIR,
  KILO_PLUGIN_DIR,
  KILO_PLUGIN_ENTRY_BASENAME,
  makeKiloHooksBridgePath,
} from "./kilo-paths.js";

const TOOL_SUFFIX = ".kilo.md";

export const kilo: AiTool<HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins> = {
  kind: "ai",
  toolId: "kilo",
  distributionProbes: { marketplace: ["kilo.json"] },
  directory: KILO_DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "Kilo Code",
  telemetryLocalRead: {
    kind: "unsupported",
    reason: "Kilo OpenTelemetry is experimental and not yet supported by AIDD.",
  },
  telemetryTaskAttributable: false,
  signalDir: ".kilo/commands",
  configOutputPaths: { "kilo.json": "kilo.json" },
  buildContracts: { flat: buildKiloFlatContract },

  capabilities: {
    agents: new AgentsCapability({
      directory: KILO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      format: "markdown",
      convertFrontmatter: (fm) => ({ description: fm.description, mode: "subagent" }),
    }),
    skills: new SkillsCapability({
      directory: KILO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) =>
        `${KILO_DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      convertFrontmatter: (fm) => fm,
    }),
    commands: new CommandsCapability({
      directory: KILO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => buildAiddCommandFilePath(KILO_DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) =>
        convertCommandFrontmatterNoHint(fm, relativeFileName),
    }),
    rules: new RulesCapability({
      directory: KILO_DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) =>
        `${KILO_DIRECTORY}rules/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
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
      transformContent: transformMcpToOpencode,
      consumes: [CONFIG_MCP],
      resolveOutputPath: async (projectRoot, fs) => {
        const jsonExists = await fs.fileExists(join(projectRoot, "kilo.json"));
        const jsoncExists = await fs.fileExists(join(projectRoot, "kilo.jsonc"));
        if (jsonExists && jsoncExists) throw new KiloDualConfigError();
        return jsoncExists ? "kilo.jsonc" : "kilo.json";
      },
    }),
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      acceptsHooks: true,
      flatHooksDir: KILO_HOOKS_DIR,
      flatHooksLoaderEntry: { dir: KILO_PLUGIN_DIR, baseName: KILO_PLUGIN_ENTRY_BASENAME },
      flatHooksBridge: {
        generate: generateKiloHooksBridge,
        path: makeKiloHooksBridgePath,
        skipIfSourceHas: KILO_PLUGIN_ENTRY_BASENAME,
      },
    }),
  },

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.kilo\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.kilo/commands/aidd/$2/$3"
    );
  },
};

registerTool(kilo);
