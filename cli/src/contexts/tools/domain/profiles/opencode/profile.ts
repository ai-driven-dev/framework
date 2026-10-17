import { join } from "node:path";
import { OpencodeDualConfigError } from "../../../../../kernel/errors.js";
import { AgentsCapability } from "../../capabilities/agents-capability.js";
import { CommandsCapability } from "../../capabilities/commands-capability.js";
import { CONFIG_MCP, CONFIG_OPENCODE } from "../../capabilities/config-refs.js";
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
import { buildOpencodeFlatContract, transformMcpToOpencode } from "./build.js";
import { generateOpencodeHooksBridge } from "./opencode-hooks-bridge.js";
import {
  makeOpencodeHooksBridgePath,
  OPENCODE_DIRECTORY,
  OPENCODE_EVENTS_ASSET,
  OPENCODE_EVENTS_PATH,
  OPENCODE_FLAT_HOOKS_DIR,
  OPENCODE_HOOKS_DIR,
  OPENCODE_PLUGIN_ENTRY_BASENAME,
} from "./opencode-paths.js";

const DIRECTORY = OPENCODE_DIRECTORY;
const TOOL_SUFFIX = ".opencode.md";

export const opencode: AiTool<
  HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins
> = {
  kind: "ai",
  toolId: "opencode",
  distributionProbes: {
    marketplace: ["opencode.json"],
  },
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  displayName: "OpenCode",
  signalDir: ".opencode/commands",
  configOutputPaths: { "opencode.json": "opencode.json" },
  pluginRuntimeFiles: { [OPENCODE_EVENTS_ASSET]: OPENCODE_EVENTS_PATH },
  buildContracts: { flat: buildOpencodeFlatContract },

  capabilities: {
    agents: new AgentsCapability({
      directory: DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      format: "markdown",
      convertFrontmatter: (fm) => ({ description: fm.description, mode: "subagent" }),
    }),
    skills: new SkillsCapability({
      directory: DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) =>
        `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      convertFrontmatter: (fm) => fm,
    }),
    commands: new CommandsCapability({
      directory: DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter: (fm, relativeFileName) =>
        convertCommandFrontmatterNoHint(fm, relativeFileName),
    }),
    rules: new RulesCapability({
      directory: DIRECTORY,
      toolSuffix: TOOL_SUFFIX,
      buildInstallPath: (fileName) => `${DIRECTORY}rules/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      convertFrontmatter: (fm) => {
        if (fm.alwaysApply === false && fm.description !== undefined) {
          return { description: fm.description };
        }
        return {};
      },
    }),
    mcp: new McpCapability({
      outputPath: "opencode.json",
      format: "json",
      entrySection: "mcp",
      mergeStrategy: "framework-prime",
      transformContent: transformMcpToOpencode,
      consumes: [CONFIG_MCP, CONFIG_OPENCODE],
      resolveOutputPath: async (projectRoot, fs) => {
        const jsonExists = await fs.fileExists(join(projectRoot, "opencode.json"));
        const jsoncExists = await fs.fileExists(join(projectRoot, "opencode.jsonc"));
        if (jsonExists && jsoncExists) throw new OpencodeDualConfigError();
        if (jsoncExists) return "opencode.jsonc";
        return "opencode.json";
      },
    }),
    // Flat mode has no `marketplaceSettings` field, and opencode's `plugin[]` array accepts
    // only npm package names — no source or version a marketplace entry could express.
    plugins: new PluginsCapability({
      mode: "flat",
      flatNamespacePrefix: "aidd-",
      acceptsHooks: true,
      flatHooksDir: OPENCODE_HOOKS_DIR,
      flatHooksLoaderEntry: {
        dir: OPENCODE_FLAT_HOOKS_DIR,
        baseName: OPENCODE_PLUGIN_ENTRY_BASENAME,
      },
      flatHooksBridge: {
        generate: generateOpencodeHooksBridge,
        path: makeOpencodeHooksBridgePath,
        skipIfSourceHas: OPENCODE_PLUGIN_ENTRY_BASENAME,
      },
    }),
  },

  rewriteContent(content: string): string {
    return content.replace(
      /(@?)\.opencode\/commands\/(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1.opencode/commands/aidd/$2/$3"
    );
  },
};

registerTool(opencode);
