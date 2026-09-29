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
import { convertCommandFrontmatter, stripToolSuffix } from "../../formats/command.js";
import { registerTool } from "../../registry.js";
import { buildMistralContract, buildMistralFlatContract } from "./build.js";
import {
  MISTRAL_HOOKS_SKIP_REASON,
  MISTRAL_MCP_PATH,
  MISTRAL_WORKSPACE_DIR,
} from "./mistral-paths.js";
import { convertMistralSkillFrontmatter } from "./mistral-skill-frontmatter.js";

const DIRECTORY = MISTRAL_WORKSPACE_DIR;
const TOOL_SUFFIX = ".md";

export const mistral: AiTool<HasAgents & HasSkills & HasCommands & HasRules & HasMcp & HasPlugins> =
  {
    kind: "ai",
    toolId: "mistral",
    distributionProbes: {
      manifest: [".vibe-plugin/plugin.json"],
      marketplace: [".vibe-plugin/marketplace.json"],
    },
    directory: DIRECTORY,
    toolSuffix: TOOL_SUFFIX,
    displayName: "Mistral Vibe",
    telemetryLocalRead: {
      kind: "unsupported",
      reason: "Vibe has no local session transcript AIDD can read.",
    },
    telemetryTaskAttributable: false,
    signalDir: ".vibe/commands",
    buildContracts: { marketplace: buildMistralContract, flat: buildMistralFlatContract },

    capabilities: {
      agents: new AgentsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        format: "markdown",
        convertFrontmatter: (fm) => {
          // Vibe reads name and description only; every other AIDD key is dropped.
          const result: Record<string, unknown> = {};
          if (fm.name !== undefined) result.name = fm.name;
          if (fm.description !== undefined) result.description = fm.description;
          return result;
        },
      }),
      skills: new SkillsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
        convertFrontmatter: convertMistralSkillFrontmatter,
      }),
      commands: new CommandsCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) => {
          // Vibe flattens phase dirs away: phase-prefixed commands land directly under commands/.
          const slashIdx = fileName.indexOf("/");
          if (slashIdx !== -1) {
            const phaseDir = fileName.slice(0, slashIdx);
            const rest = fileName.slice(slashIdx + 1);
            const phase = phaseDir.match(/^(\d+)/)?.[1];
            if (phase) return `${DIRECTORY}commands/${rest}`;
          }
          return `${DIRECTORY}commands/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
        },
        convertFrontmatter: (fm, relativeFileName) =>
          convertCommandFrontmatter(fm, relativeFileName),
      }),
      rules: new RulesCapability({
        directory: DIRECTORY,
        toolSuffix: TOOL_SUFFIX,
        buildInstallPath: (fileName) =>
          `${DIRECTORY}rules/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
        convertFrontmatter: (fm) => {
          if ("paths" in fm) {
            const paths = fm.paths;
            if (Array.isArray(paths) && paths.length === 0) return {};
            return { paths };
          }
          if ("globs" in fm) return { paths: fm.globs };
          if ("alwaysApply" in fm) {
            if (fm.alwaysApply === false && fm.description !== undefined) {
              return { description: fm.description };
            }
            return {};
          }
          return {};
        },
      }),
      mcp: new McpCapability({
        outputPath: MISTRAL_MCP_PATH,
        format: "json",
        entrySection: "mcpServers",
        consumes: [CONFIG_MCP],
      }),
      plugins: new PluginsCapability({
        mode: "flat",
        flatNamespacePrefix: "aidd-",
        acceptsHooks: false,
        hooksUnsupportedReason: MISTRAL_HOOKS_SKIP_REASON,
      }),
    },

    rewriteContent(content: string): string {
      return content.replace(
        /(@?)\.vibe\/commands\/(\d+)[_-][^/]+\//g,
        (_, at, phase) => `${at}${DIRECTORY}commands/${phase}/`
      );
    },
  };

registerTool(mistral);
