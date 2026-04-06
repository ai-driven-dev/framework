import { join } from "node:path";
import type { FileSystem } from "../ports/file-system.js";
import {
  AT_DOCS_PLACEHOLDER,
  AT_TOOLS_PLACEHOLDER,
  DOCS_PLACEHOLDER,
  TOOLS_PLACEHOLDER,
} from "./framework-descriptor.js";
import type { MergeStrategy } from "./merge-strategy.js";

export type ToolId = "claude" | "cursor" | "copilot" | "opencode";
export const VALID_TOOL_IDS: readonly ToolId[] = ["claude", "cursor", "copilot", "opencode"];

export function assertValidToolIds(toolIds: string[]): void {
  const invalid = toolIds.filter((t) => !VALID_TOOL_IDS.includes(t as ToolId));
  if (invalid.length === 0) return;
  throw new Error(
    `Unknown tool(s): ${invalid.join(", ")}. Valid tools: ${VALID_TOOL_IDS.join(", ")}`
  );
}

export type UserFileSection = "agents" | "commands" | "rules" | "skills";

export interface UserFileSectionKey {
  section: UserFileSection;
  key: string;
}

export interface SectionHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>, fileName?: string): Record<string, unknown>;
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
}

export interface CommandsHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(
    fm: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown>;
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
}

export interface RulesHandler {
  buildFilePath(fileName: string): string | null;
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown>;
}

export interface ConfigHandler {
  outputPath(configName: string): string | null;
  mergeStrategy(configName: string): MergeStrategy;
  transformContent?(configName: string, content: string): string;
  resolveOutputPath?(
    configName: string,
    projectRoot: string,
    fs: FileSystem
  ): Promise<string | null>;
}

export interface MemoryBankHandler {
  outputPath(templateName: string): string | null;
  rewriteContent(content: string, docsDir: string): string;
}

export interface ToolConfig {
  readonly toolId: ToolId;
  readonly directory: string;
  readonly toolSuffix: string;
  readonly signalDir: string;
  rewriteContent(content: string, docsDir: string): string;
  reverseRewriteContent(content: string, docsDir: string): string;
  agents(): SectionHandler;
  commands(): CommandsHandler;
  rules(): RulesHandler;
  skills(): SectionHandler;
  config(): ConfigHandler;
  memoryBank(): MemoryBankHandler;
  detectUserFileSectionKey(relativePath: string): UserFileSectionKey | null;
}

export function agentNameFromFrontmatter(
  fm: Record<string, unknown>,
  fileName?: string
): string | undefined {
  const base = fileName?.split("/").at(-1);
  const name = fm.name ?? base?.replace(/\.md$/, "");
  return typeof name === "string" ? name : undefined;
}

const TOOL_SUFFIXES = VALID_TOOL_IDS.map((id) => `.${id}.md`);

export function acceptsFile(config: ToolConfig, fileName: string): boolean {
  const basename = fileName.split("/").at(-1) ?? fileName;
  const otherSuffixes = TOOL_SUFFIXES.filter((s) => s !== config.toolSuffix);
  return !otherSuffixes.some((s) => basename.endsWith(s));
}

export function stripToolSuffix(suffix: string, fileName: string): string {
  const basename = fileName.split("/").at(-1) ?? fileName;
  if (!basename.endsWith(suffix)) return fileName;
  const dir = fileName.slice(0, fileName.length - basename.length);
  const stripped = `${basename.slice(0, -suffix.length)}.md`;
  return `${dir}${stripped}`;
}

// Global singleton registry. Side effect on import: each tool file (claude.ts, cursor.ts, copilot.ts)
// calls registerTool() at module level. Tests import tool configs directly and do not use this registry,
// so no reset mechanism is needed in practice.
const TOOL_REGISTRY = new Map<ToolId, ToolConfig>();

export function registerTool(config: ToolConfig): void {
  TOOL_REGISTRY.set(config.toolId, config);
}

export function getToolConfig(toolId: ToolId): ToolConfig {
  const config = TOOL_REGISTRY.get(toolId);
  if (!config) throw new Error(`Tool '${toolId}' is not registered.`);
  return config;
}

export function getAllRegisteredTools(): Map<ToolId, ToolConfig> {
  return new Map(TOOL_REGISTRY);
}

export function baseRewriteContent(content: string, directory: string, docsDir: string): string {
  return content
    .replaceAll(AT_TOOLS_PLACEHOLDER, `@${directory}`)
    .replaceAll(AT_DOCS_PLACEHOLDER, `@${docsDir}/`)
    .replaceAll(TOOLS_PLACEHOLDER, directory)
    .replaceAll(DOCS_PLACEHOLDER, `${docsDir}/`);
}

export function baseReverseRewriteContent(
  content: string,
  directory: string,
  docsDir: string
): string {
  return content
    .replaceAll(`@${directory}`, AT_TOOLS_PLACEHOLDER)
    .replaceAll(`@${docsDir}/`, AT_DOCS_PLACEHOLDER)
    .replaceAll(directory, TOOLS_PLACEHOLDER)
    .replaceAll(`${docsDir}/`, DOCS_PLACEHOLDER);
}

export const namedAgentsFrontmatter = {
  convertFrontmatter(fm: Record<string, unknown>, fileName?: string): Record<string, unknown> {
    return { name: agentNameFromFrontmatter(fm, fileName), description: fm.description };
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return { name: fm.name, description: fm.description };
  },
};

export function namedAgentsSectionHandler(directory: string, toolSuffix: string): SectionHandler {
  return {
    buildFilePath(fileName: string): string {
      return `${directory}agents/${stripToolSuffix(toolSuffix, fileName)}`;
    },
    ...namedAgentsFrontmatter,
  };
}

export const passthroughFrontmatter = {
  convertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return fm;
  },
};

export function passthroughSkillsHandler(directory: string, toolSuffix: string): SectionHandler {
  return {
    buildFilePath(fileName: string): string {
      return `${directory}skills/${stripToolSuffix(toolSuffix, fileName)}`;
    },
    ...passthroughFrontmatter,
  };
}

function buildCommandName(fm: Record<string, unknown>, relativeFileName: string): string {
  const phase = relativeFileName.split("/")[0]?.match(/^(\d+)/)?.[1];
  const baseName = String(fm.name ?? "");
  return phase ? `aidd:${phase}:${baseName}` : baseName;
}

function stripCommandNamePrefix(fm: Record<string, unknown>): string {
  const rawName = String(fm.name ?? "");
  const match = /^aidd:\d+:(.+)$/.exec(rawName);
  return match ? match[1] : rawName;
}

// Used by claude, cursor, copilot — includes argument-hint when present.
export function convertCommandFrontmatter(
  fm: Record<string, unknown>,
  relativeFileName: string
): Record<string, unknown> {
  const name = buildCommandName(fm, relativeFileName);
  const result: Record<string, unknown> = { name, description: fm.description };
  if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
  return result;
}

// Used by opencode — omits argument-hint (opencode uses filename as command name).
export function convertCommandFrontmatterNoHint(
  fm: Record<string, unknown>,
  relativeFileName: string
): Record<string, unknown> {
  const name = buildCommandName(fm, relativeFileName);
  return { name, description: fm.description };
}

// Used by claude, cursor, copilot — preserves argument-hint when present.
export function reverseConvertCommandFrontmatter(
  fm: Record<string, unknown>
): Record<string, unknown> {
  const name = stripCommandNamePrefix(fm);
  const result: Record<string, unknown> = { name, description: fm.description };
  if (fm["argument-hint"] !== undefined) result["argument-hint"] = fm["argument-hint"];
  return result;
}

// Used by opencode — omits argument-hint.
export function reverseConvertCommandFrontmatterNoHint(
  fm: Record<string, unknown>
): Record<string, unknown> {
  const name = stripCommandNamePrefix(fm);
  return { name, description: fm.description };
}

export function buildAiddCommandFilePath(dir: string, fileName: string): string {
  const slashIdx = fileName.indexOf("/");
  if (slashIdx !== -1) {
    const phaseDir = fileName.slice(0, slashIdx);
    const baseName = fileName.slice(slashIdx + 1);
    const phase = phaseDir.match(/^(\d+)/)?.[1];
    if (phase) {
      return `${dir}commands/aidd/${phase}/${baseName}`;
    }
  }
  const baseName = fileName.split("/").at(-1) ?? fileName;
  return `${dir}commands/aidd/${baseName}`;
}

export function detectSectionKeyFromPrefixes(
  relativePath: string,
  prefixes: [string, "agents" | "commands" | "rules" | "skills"][]
): UserFileSectionKey | null {
  for (const [prefix, section] of prefixes) {
    if (relativePath.startsWith(prefix)) return { section, key: relativePath.slice(prefix.length) };
  }
  return null;
}

export const standardCommandFrontmatter = {
  convertFrontmatter(
    fm: Record<string, unknown>,
    relativeFileName: string
  ): Record<string, unknown> {
    return convertCommandFrontmatter(fm, relativeFileName);
  },
  reverseConvertFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
    return reverseConvertCommandFrontmatter(fm);
  },
};

export function buildStandardCommandsHandler(
  buildFilePath: (fileName: string) => string | null
): CommandsHandler {
  return {
    buildFilePath,
    ...standardCommandFrontmatter,
  };
}

export async function hasToolSignals(
  fs: FileSystem,
  config: ToolConfig,
  projectRoot: string
): Promise<boolean> {
  const dir = join(projectRoot, config.signalDir);
  if (!(await fs.fileExists(dir))) return false;
  const files = await fs.listDirectory(dir);
  for (const filePath of files) {
    if (!filePath.endsWith(".md")) continue;
    const content = await fs.readFile(join(dir, filePath));
    if (/^name:\s*['"]?aidd[_:]/m.test(content)) return true;
  }
  return false;
}
