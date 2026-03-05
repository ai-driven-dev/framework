import type { ContentSection } from "./framework-descriptor.js";

export type ToolId = "claude" | "cursor" | "copilot";
export const VALID_TOOL_IDS: readonly ToolId[] = ["claude", "cursor", "copilot"];

export interface ToolConfig {
  readonly toolId: ToolId;
  readonly directory: string;
  readonly toolSuffix: string;
  buildFilePath(section: ContentSection, fileName: string): string | null;
  rewriteContent(content: string, docsDir: string): string;
  convertFrontmatter(fm: Record<string, unknown>, section: ContentSection): Record<string, unknown>;
  getConfigOutputPath(configName: string): string | null;
  getMemoryBankOutputPath(templateName: string): string | null;
  shouldProcess?(section: ContentSection, frontmatter: Record<string, unknown>): boolean;
  rewriteMemoryBankContent?(content: string, docsDir: string): string;
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
