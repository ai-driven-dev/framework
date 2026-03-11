import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  CONFIG_MCP,
  CONFIG_VSCODE_EXTENSIONS,
  CONFIG_VSCODE_KEYBINDINGS,
  CONFIG_VSCODE_SETTINGS,
  DOCS_PLACEHOLDER,
  GITKEEP_FILE,
  TEMPLATE_AGENTS_MD,
  TOOLS_PLACEHOLDER,
} from "../models/framework-descriptor.js";
import { parseFrontmatter } from "../models/frontmatter.js";
import {
  type CommandsHandler,
  type ConfigHandler,
  type MemoryBankHandler,
  type RulesHandler,
  type SectionHandler,
  type ToolConfig,
  type UserFileSectionKey,
  registerTool,
} from "../models/tool-config.js";

const DIRECTORY = ".github/";
const TOOL_SUFFIX = ".copilot.md";

const EXT_AGENT = ".agent.md";
const EXT_PROMPT = ".prompt.md";
const EXT_INSTRUCTIONS = ".instructions.md";

function basename(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function flattenFileName(
  fileName: string,
  targetExt: string,
  options: { toolSuffix?: string; stripNumericPrefix?: boolean } = {}
): string {
  const parts = fileName.split("/");
  let baseName = parts[parts.length - 1];

  if (options.stripNumericPrefix) {
    baseName = baseName.replace(/^\d+[_-]/, "");
  }
  if (options.toolSuffix && baseName.endsWith(options.toolSuffix)) {
    baseName = `${baseName.slice(0, -options.toolSuffix.length)}.md`;
  }
  baseName = baseName.replaceAll("_", "-");

  const withExt = addTargetExtension(baseName, targetExt);

  if (parts.length === 1) {
    return withExt;
  }

  const prefix = buildPrefix(parts.slice(0, -1).join("/"));
  return `${prefix}-${withExt}`;
}

function buildPrefix(subPath: string): string {
  return subPath
    .split("/")
    .map((p) => p.replace(/^(\d+)[_-].*$/, "$1"))
    .join("-");
}

function addTargetExtension(baseName: string, targetExt: string): string {
  if (baseName.endsWith(targetExt)) return baseName;
  const withoutMd = baseName.endsWith(".md") ? baseName.slice(0, -3) : baseName;
  return `${withoutMd}${targetExt}`;
}

function escapedRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const agentsHandler: SectionHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const name = base.endsWith(".md") ? `${base.slice(0, -3)}${EXT_AGENT}` : base;
    return `${DIRECTORY}agents/${name}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return { name: fm.name, description: fm.description };
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return { name: fm.name, description: fm.description };
  },
};

const commandsHandler: CommandsHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_PROMPT);
    return `${DIRECTORY}prompts/${flat}`;
  },
  convertFrontmatter(
    fm: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown> {
    const phase = relativeFileName.split("/")[0]?.match(/^(\d+)/)?.[1];
    const baseName = String(fm.name ?? "");
    const name = phase ? `aidd_${phase}_${baseName}` : baseName;
    const result: Record<string, unknown> = { name, description: fm.description };
    if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
    return result;
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    const rawName = String(fm.name ?? "");
    const match = /^aidd_\d+_(.+)$/.exec(rawName);
    const name = match ? match[1] : rawName;
    const result: Record<string, unknown> = { name, description: fm.description };
    if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
    return result;
  },
};

const rulesHandler: RulesHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    const flat = flattenFileName(fileName, EXT_INSTRUCTIONS, {
      toolSuffix: TOOL_SUFFIX,
      stripNumericPrefix: true,
    });
    return `${DIRECTORY}instructions/${flat}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    const { paths, globs } = fm;
    const patterns = Array.isArray(paths) ? paths : Array.isArray(globs) ? globs : null;
    if (patterns !== null && patterns.length > 0) return { applyTo: patterns.join(",") };
    return {};
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    const { applyTo } = fm;
    if (typeof applyTo === "string" && applyTo !== "**") {
      return { paths: applyTo.split(",").map((s) => s.trim()) };
    }
    // applyTo: "**" or absent → no paths (always apply)
    return {};
  },
};

const skillsHandler: SectionHandler = {
  buildFilePath(fileName: string): string | null {
    const base = basename(fileName);
    if (base === GITKEEP_FILE) return null;
    return `${DIRECTORY}skills/${fileName}`;
  },
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
};

function resolveInstalledPath(path: string): string {
  if (path.startsWith("agents/")) {
    const subPath = path.slice("agents/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}agents/${subPath}`;
    return agentsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("commands/")) {
    const subPath = path.slice("commands/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}prompts/${subPath}`;
    return commandsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("rules/")) {
    const subPath = path.slice("rules/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}instructions/${subPath}`;
    return rulesHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  if (path.startsWith("skills/")) {
    const subPath = path.slice("skills/".length);
    if (subPath === "" || subPath.endsWith("/")) return `${DIRECTORY}skills/${subPath}`;
    return skillsHandler.buildFilePath(subPath) ?? `${DIRECTORY}${path}`;
  }
  // Unknown section: fall back to raw directory-prefixed path.
  // If a new section is added to the framework, this produces a predictable
  // default rather than silently dropping the reference.
  return `${DIRECTORY}${path}`;
}

function rewriteCopilotContent(content: string, docsDir: string): string {
  return (
    content
      .replace(
        new RegExp(`${escapedRegex(AT_TOOLS_PLACEHOLDER)}([^\\s\`'">,]+)`, "g"),
        (_match, path: string) => {
          const fullPath = resolveInstalledPath(path);
          return `[${fullPath}](../../${fullPath})`;
        }
      )
      .replace(
        new RegExp(`${escapedRegex(AT_DOCS_PLACEHOLDER)}([^\\s\`'">,]+)`, "g"),
        (_match, path: string) => {
          return `[${docsDir}/${path}](../../${docsDir}/${path})`;
        }
      )
      // {{TOOLS}}/ (without @) replaces directory prefix only — used for path references in frontmatter or prose.
      // @{{TOOLS}}/ (with @) resolves to a full installed path via resolveInstalledPath — used for @-include syntax.
      .replaceAll("{{TOOLS}}/agents/", `${DIRECTORY}agents/`)
      .replace(/\{\{TOOLS\}\}\/commands\/([^\s\n`'">,]+)/g, (_match, path: string) => {
        const flat = flattenFileName(path, EXT_PROMPT);
        return `${DIRECTORY}prompts/${flat}`;
      })
      .replaceAll("{{TOOLS}}/rules/", `${DIRECTORY}instructions/`)
      .replaceAll("{{TOOLS}}/skills/", `${DIRECTORY}skills/`)
      .replaceAll(TOOLS_PLACEHOLDER, DIRECTORY)
      .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`)
  );
}

function reverseCopilotContent(content: string, docsDir: string): string {
  return content
    .replace(
      /\[\.github\/agents\/([^\]]+)\]\([^)]+\)/g,
      (_match, path: string) => `${AT_TOOLS_PLACEHOLDER}agents/${path}`
    )
    .replace(
      /\[\.github\/prompts\/([^\]]+)\]\([^)]+\)/g,
      (_match, path: string) => `${AT_TOOLS_PLACEHOLDER}commands/${path}`
    )
    .replace(
      /\[\.github\/instructions\/([^\]]+)\]\([^)]+\)/g,
      (_match, path: string) => `${AT_TOOLS_PLACEHOLDER}rules/${path}`
    )
    .replace(
      /\[\.github\/skills\/([^\]]+)\]\([^)]+\)/g,
      (_match, path: string) => `${AT_TOOLS_PLACEHOLDER}skills/${path}`
    )
    .replace(
      new RegExp(`\\[${escapedRegex(docsDir)}\\/([^\\]]+)\\]\\([^)]+\\)`, "g"),
      (_match: string, path: string) => `${AT_DOCS_PLACEHOLDER}${path}`
    )
    .replaceAll(`${DIRECTORY}agents/`, `${TOOLS_PLACEHOLDER}agents/`)
    .replaceAll(`${DIRECTORY}prompts/`, `${TOOLS_PLACEHOLDER}commands/`)
    .replaceAll(`${DIRECTORY}instructions/`, `${TOOLS_PLACEHOLDER}rules/`)
    .replaceAll(`${DIRECTORY}skills/`, `${TOOLS_PLACEHOLDER}skills/`)
    .replaceAll(DIRECTORY, TOOLS_PLACEHOLDER)
    .replaceAll(`${docsDir}/`, DOCS_PLACEHOLDER);
}

export const copilotToolConfig: ToolConfig = {
  toolId: "copilot",
  directory: DIRECTORY,
  toolSuffix: TOOL_SUFFIX,

  rewriteContent: rewriteCopilotContent,

  reverseRewriteContent: reverseCopilotContent,

  agents(): SectionHandler {
    return agentsHandler;
  },

  commands(): CommandsHandler {
    return commandsHandler;
  },

  rules(): RulesHandler {
    return rulesHandler;
  },

  skills(): SectionHandler {
    return skillsHandler;
  },

  config(): ConfigHandler {
    return {
      outputPath(configName: string): string | null {
        if (configName === CONFIG_MCP) return ".vscode/mcp.json";
        if (configName === CONFIG_VSCODE_EXTENSIONS) return ".vscode/extensions.json";
        if (configName === CONFIG_VSCODE_KEYBINDINGS) return ".vscode/keybindings.json";
        if (configName === CONFIG_VSCODE_SETTINGS) return ".vscode/settings.json";
        return null;
      },
      shouldMerge(configName: string): boolean {
        return configName === CONFIG_VSCODE_SETTINGS;
      },
    };
  },

  memoryBank(): MemoryBankHandler {
    return {
      outputPath(templateName: string): string | null {
        if (templateName === TEMPLATE_AGENTS_MD) return `${DIRECTORY}copilot-instructions.md`;
        return null;
      },
      rewriteContent(content: string, docsDir: string): string {
        const rewritten = rewriteCopilotContent(content, docsDir);
        const { body } = parseFrontmatter(rewritten);
        return body
          .replace(/^\n+/, "")
          .replace(/^# AGENTS\.md[ \t]*\n/, "# Copilot Instructions\n")
          .replace(/\]\(\.\.\/\.\.\//g, "](../")
          .replace(new RegExp(`\\]\\(${docsDir}/`, "g"), `](../${docsDir}/`);
      },
    };
  },

  detectUserFileSectionKey(relativePath: string): UserFileSectionKey | null {
    if (relativePath.startsWith(`${DIRECTORY}agents/`)) {
      const base = relativePath.slice(`${DIRECTORY}agents/`.length);
      const key = base.endsWith(EXT_AGENT) ? `${base.slice(0, -EXT_AGENT.length)}.md` : base;
      return { section: "agents", key };
    }
    if (relativePath.startsWith(`${DIRECTORY}skills/`)) {
      return { section: "skills", key: relativePath.slice(`${DIRECTORY}skills/`.length) };
    }
    // commands (prompts) and rules (instructions) use flattenFileName which is not reversible
    return null;
  },
};

registerTool(copilotToolConfig);
