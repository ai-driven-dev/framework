export type ToolId = "claude" | "cursor" | "copilot" | "opencode";
export const VALID_TOOL_IDS: readonly ToolId[] = ["claude", "cursor", "copilot", "opencode"];

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
  shouldMerge(configName: string): boolean;
  transformContent?(configName: string, content: string): string;
}

export interface MemoryBankHandler {
  outputPath(templateName: string): string | null;
  rewriteContent(content: string, docsDir: string): string;
}

export interface ToolConfig {
  readonly toolId: ToolId;
  readonly directory: string;
  readonly toolSuffix: string;
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
