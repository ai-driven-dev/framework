import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  CONFIG_MCP,
  CONFIG_OPENCODE,
  DOCS_PLACEHOLDER,
  TEMPLATE_AGENTS_MD,
  TOOLS_PLACEHOLDER,
} from "../models/framework-descriptor.js";
import {
  type CommandsHandler,
  type ConfigHandler,
  type MemoryBankHandler,
  type RulesHandler,
  registerTool,
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
const descriptionOnlyFrontmatter = {
  convertFrontmatter: (fm: Record<string, unknown>) => ({ description: fm.description }),
  reverseConvertFrontmatter: (fm: Record<string, unknown>) => ({ description: fm.description }),
};

export const opencodeToolConfig: ToolConfig = {
  toolId: "opencode",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  rewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(AT_TOOLS_PLACEHOLDER, `@${DIRECTORY}`)
      .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`);
  },

  reverseRewriteContent(content: string, docsDir: string): string {
    return content
      .replaceAll(`@${DIRECTORY}`, AT_TOOLS_PLACEHOLDER)
      .replaceAll(`@${docsDir}/`, AT_DOCS_PLACEHOLDER)
      .replaceAll(DIRECTORY, TOOLS_PLACEHOLDER)
      .replaceAll(`${docsDir}/`, DOCS_PLACEHOLDER);
  },

  agents(): SectionHandler {
    return {
      buildFilePath: (fileName) => `${DIRECTORY}agents/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      ...descriptionOnlyFrontmatter,
    };
  },

  commands(): CommandsHandler {
    return {
      buildFilePath: (fileName) => `${DIRECTORY}commands/${stripToolSuffix(TOOL_SUFFIX, fileName)}`,
      ...descriptionOnlyFrontmatter,
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
      convertFrontmatter(_fm: Record<string, unknown>): Record<string, unknown> {
        return {};
      },
      reverseConvertFrontmatter(_fm: Record<string, unknown>): Record<string, unknown> {
        return {};
      },
    };
  },

  skills(): SectionHandler {
    return {
      buildFilePath(fileName: string): string {
        return `${DIRECTORY}skills/${stripToolSuffix(TOOL_SUFFIX, fileName)}`;
      },
      convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return fm;
      },
      reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
        return fm;
      },
    };
  },

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_OPENCODE) return "opencode.json";
        if (configName === CONFIG_MCP) return "opencode.json";
        return null;
      },
      shouldMerge(configName: string): boolean {
        return configName === CONFIG_OPENCODE || configName === CONFIG_MCP;
      },
      transformContent(configName: string, content: string): string {
        if (configName === CONFIG_MCP) return transformMcpToOpencode(content);
        return content;
      },
    };
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
    const prefixes: [string, "agents" | "commands" | "rules" | "skills"][] = [
      [`${DIRECTORY}agents/`, "agents"],
      [`${DIRECTORY}commands/`, "commands"],
      [`${DIRECTORY}rules/`, "rules"],
      [`${DIRECTORY}skills/`, "skills"],
    ];
    for (const [prefix, section] of prefixes) {
      if (relativePath.startsWith(prefix))
        return { section, key: relativePath.slice(prefix.length) };
    }
    return null;
  },
};

registerTool(opencodeToolConfig);
