import { parseFrontmatter, serializeFrontmatter } from "../formats/markdown.js";
import type {
  AiTool,
  HasAgents,
  HasCommands,
  HasRules,
  HasSkills,
  UserFileSectionKey,
} from "../tools/contracts.js";
import type { Plugin } from "./plugin.js";
import { AI_TOOL_IDS } from "./tool-ids.js";

export type SyncCapabilities = HasAgents & HasSkills & Partial<HasCommands & HasRules>;

export function canonicalFrameworkKey(frameworkPath: string): string {
  for (const id of AI_TOOL_IDS) {
    const suffix = `.${id}.md`;
    if (frameworkPath.endsWith(suffix)) {
      return frameworkPath.slice(0, -suffix.length);
    }
  }
  return frameworkPath;
}

export function getSyncCapabilities(config: AiTool<unknown>): SyncCapabilities {
  return config.capabilities as SyncCapabilities;
}

export function getSectionKeyFromFrameworkPath(frameworkPath: string): UserFileSectionKey | null {
  if (frameworkPath.startsWith("agents/"))
    return { section: "agents", key: frameworkPath.slice("agents/".length) };
  if (frameworkPath.startsWith("commands/"))
    return { section: "commands", key: frameworkPath.slice("commands/".length) };
  if (frameworkPath.startsWith("rules/"))
    return { section: "rules", key: frameworkPath.slice("rules/".length) };
  if (frameworkPath.startsWith("skills/"))
    return { section: "skills", key: frameworkPath.slice("skills/".length) };
  return null;
}

function reverseConvertSection(
  config: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const caps = getSyncCapabilities(config);
  if (sectionKey.section === "agents") return caps.agents.reverseConvertFrontmatter(frontmatter);
  if (sectionKey.section === "commands")
    return caps.commands?.reverseConvertFrontmatter(frontmatter) ?? frontmatter;
  if (sectionKey.section === "rules")
    return caps.rules?.reverseConvertFrontmatter(frontmatter) ?? frontmatter;
  return caps.skills.reverseConvertFrontmatter(frontmatter);
}

function convertSection(
  config: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  frontmatter: Record<string, unknown>
): Record<string, unknown> {
  const caps = getSyncCapabilities(config);
  if (sectionKey.section === "agents") return caps.agents.convertFrontmatter(frontmatter);
  if (sectionKey.section === "commands")
    return caps.commands?.convertFrontmatter(frontmatter, sectionKey.key) ?? frontmatter;
  if (sectionKey.section === "rules")
    return caps.rules?.convertFrontmatter(frontmatter) ?? frontmatter;
  return caps.skills.convertFrontmatter(frontmatter);
}

export function transformContent(
  content: string,
  sourceConfig: AiTool<unknown>,
  targetConfig: AiTool<unknown>,
  sectionKey: UserFileSectionKey,
  docsDir: string
): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const canonicalFrontmatter = reverseConvertSection(sourceConfig, sectionKey, frontmatter);
  const targetFrontmatter = convertSection(targetConfig, sectionKey, canonicalFrontmatter);
  const canonicalBody = sourceConfig.reverseRewriteContent(body, docsDir);
  const targetBody = targetConfig.rewriteContent(canonicalBody, docsDir);
  return serializeFrontmatter(targetFrontmatter, targetBody);
}

export function buildTargetPath(
  targetConfig: AiTool<unknown>,
  sectionKey: UserFileSectionKey
): string | null {
  const caps = getSyncCapabilities(targetConfig);
  if (sectionKey.section === "agents") return caps.agents.buildUserFilePath(sectionKey.key);
  if (sectionKey.section === "commands")
    return caps.commands?.buildInstallPath(sectionKey.key) ?? null;
  if (sectionKey.section === "rules") return caps.rules?.buildInstallPath(sectionKey.key) ?? null;
  return caps.skills.buildInstallPath(sectionKey.key);
}

export function buildReverseComponentMap(plugin: Plugin): Map<string, string> {
  const rev = new Map<string, string>();
  for (const [installPath, componentPath] of plugin.componentPaths) {
    rev.set(componentPath, installPath);
  }
  return rev;
}
