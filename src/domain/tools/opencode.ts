import { join } from "node:path";
import { ConfigConflictError } from "../errors.js";
import { CONFIG_MCP, CONFIG_OPENCODE, TEMPLATE_AGENTS_MD } from "../models/framework-descriptor.js";
import {
  baseReverseRewriteContent,
  baseRewriteContent,
  buildAiddCommandFilePath,
  type CommandsHandler,
  type ConfigHandler,
  convertCommandFrontmatterNoHint,
  detectSectionKeyFromPrefixes,
  type MemoryBankHandler,
  passthroughSkillsHandler,
  type RulesHandler,
  registerTool,
  reverseConvertCommandFrontmatterNoHint,
  type SectionHandler,
  stripToolSuffix,
  type ToolConfig,
  type UserFileSectionKey,
} from "../models/tool-config.js";

const DIRECTORY = ".opencode/";
const TOOL_SUFFIX = ".opencode.md";

type RawServer =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { url: string };

interface OpencodeMcpLocalServer {
  type: "local";
  command: string[];
  enabled: boolean;
  environment?: Record<string, string>;
}

interface OpencodeMcpRemoteServer {
  type: "remote";
  url: string;
  enabled: boolean;
}

type OpencodeMcpServer = OpencodeMcpLocalServer | OpencodeMcpRemoteServer;

function transformMcpToOpencode(content: string): string {
  let parsed: { mcpServers?: Record<string, RawServer> };
  try {
    parsed = JSON.parse(content) as typeof parsed;
  } catch (err) {
    throw new Error(`Cannot parse MCP config: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("MCP config must be a JSON object");
  }

  const mcp: Record<string, OpencodeMcpServer> = {};

  for (const [name, server] of Object.entries(parsed.mcpServers ?? {})) {
    if ("command" in server) {
      const { command, args = [], env } = server;
      const local: OpencodeMcpLocalServer = {
        type: "local",
        command: [command, ...args],
        enabled: true,
      };
      if (env && Object.keys(env).length > 0) local.environment = env;
      mcp[name] = local;
    } else if ("url" in server) {
      mcp[name] = { type: "remote", url: server.url, enabled: true };
    } else {
      throw new Error(`MCP server "${name}" must have either a "command" or "url" field`);
    }
  }

  return JSON.stringify({ mcp }, null, 2);
}

// OpenCode uses filename as name for agents and commands — no name field in frontmatter.
// Sync round-trips (opencode → other tools) lose the name; it is recovered from the filename.
// mode: subagent is required by OpenCode to register agents as subagents.
const descriptionOnlyFrontmatter = {
  convertFrontmatter: (fm: Record<string, unknown>) => ({
    description: fm.description,
    mode: "subagent",
  }),
  reverseConvertFrontmatter: (fm: Record<string, unknown>) => ({ description: fm.description }),
};

export const opencodeToolConfig: ToolConfig = {
  toolId: "opencode",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,
  signalDir: ".opencode/commands",

  rewriteContent(content: string, docsDir: string): string {
    return baseRewriteContent(content, DIRECTORY, docsDir).replace(
      /(@\.opencode\/commands\/)(\d+)[_-][^/]+\/([^\s]+)/g,
      "$1aidd/$2/$3"
    );
  },

  reverseRewriteContent(content: string, docsDir: string): string {
    return baseReverseRewriteContent(content, DIRECTORY, docsDir);
  },

  agents(): SectionHandler {
    return {
      buildFilePath: (fileName) => `${DIRECTORY}agents/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      ...descriptionOnlyFrontmatter,
    };
  },

  commands(): CommandsHandler {
    return {
      buildFilePath: (fileName) => buildAiddCommandFilePath(DIRECTORY, fileName),
      convertFrontmatter(
        fm: Record<string, unknown>,
        relativeFileName: string
      ): Record<string, unknown> {
        return convertCommandFrontmatterNoHint(fm, relativeFileName);
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return reverseConvertCommandFrontmatterNoHint(fm);
      },
    };
  },

  rules(): RulesHandler {
    return {
      // OpenCode has no built-in rules scoping — rules are installed to .opencode/rules/.
      // They are inert until opencode.json lists them under "instructions".
      // The framework's config/opencode.json template must include:
      //   { "instructions": [".opencode/rules/**/*.md"] }
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}rules/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        if (fm.alwaysApply === false && fm.description !== undefined) {
          return { description: fm.description };
        }
        return {};
      },
      reverseConvertFrontmatter(_fm: Record<string, unknown>): Record<string, unknown> {
        return {};
      },
    };
  },

  skills(): SectionHandler {
    return passthroughSkillsHandler(DIRECTORY, TOOL_SUFFIX);
  },

  config(): ConfigHandler {
    const OPENCODE_JSON = "opencode.json";
    const OPENCODE_JSONC = "opencode.jsonc";
    const handler: ConfigHandler = {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_OPENCODE || configName === CONFIG_MCP) return OPENCODE_JSON;
        return null;
      },
      shouldMerge(configName: string): boolean {
        return handler.outputPath(configName) !== null;
      },
      transformContent(configName: string, content: string): string {
        if (configName === CONFIG_MCP) return transformMcpToOpencode(content);
        return content;
      },
      async resolveOutputPath(configName, projectRoot, fs): Promise<string | null> {
        if (handler.outputPath(configName) === null) return null;
        const jsonExists = await fs.fileExists(join(projectRoot, OPENCODE_JSON));
        const jsoncExists = await fs.fileExists(join(projectRoot, OPENCODE_JSONC));
        if (jsonExists && jsoncExists)
          throw new ConfigConflictError(
            `Both ${OPENCODE_JSON} and ${OPENCODE_JSONC} exist. Remove one before continuing.`
          );
        if (jsoncExists) return OPENCODE_JSONC;
        return OPENCODE_JSON;
      },
    };
    return handler;
  },

  memoryBank(): MemoryBankHandler {
    return {
      outputPath(templateName: string): string | null {
        if (templateName === TEMPLATE_AGENTS_MD) return "AGENTS.md";
        return null;
      },
      rewriteContent(content: string, docsDir: string): string {
        return opencodeToolConfig.rewriteContent(content, docsDir);
      },
    };
  },

  detectUserFileSectionKey(relativePath: string): UserFileSectionKey | null {
    return detectSectionKeyFromPrefixes(relativePath, [
      [`${DIRECTORY}agents/`, "agents"],
      [`${DIRECTORY}commands/aidd/`, "commands"],
      [`${DIRECTORY}rules/`, "rules"],
      [`${DIRECTORY}skills/`, "skills"],
    ]);
  },
};

registerTool(opencodeToolConfig);
