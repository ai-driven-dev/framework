import { join, relative } from "node:path";
import { InvalidSourceMarketplaceError } from "../../../../domain/errors.js";
import { rewriteRelativeLinks } from "../../../../domain/formats/relative-link-rewrite.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
} from "../../../../domain/models/framework-build.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";

export interface PluginPresenceFlags {
  readonly hasAgents: boolean;
  readonly skillsList: readonly string[];
  readonly hasHooksJson: boolean;
  readonly hasMcpJson: boolean;
}

export async function hasAgentFiles(fs: FileReader, agentsDir: string): Promise<boolean> {
  if (!(await fs.fileExists(agentsDir))) return false;
  const files = await fs.listFilesRecursive(agentsDir);
  return files.some((f) => f.endsWith(PLUGIN_AGENT_INPUT_EXT));
}

export async function listSkillNames(
  fs: FileReader,
  pluginSrc: string
): Promise<readonly string[]> {
  const skillsDir = join(pluginSrc, "skills");
  if (!(await fs.fileExists(skillsDir))) return [];
  const files = await fs.listFilesRecursive(skillsDir);
  const names = new Set<string>();
  for (const f of files) {
    if (!f.endsWith("/SKILL.md") && !f.endsWith("\\SKILL.md") && !f.endsWith("SKILL.md")) {
      continue;
    }
    const rel = relative(skillsDir, f);
    const parts = rel.replace(/\\/g, "/").split("/");
    if (parts.length >= 2) names.add(parts[0]);
  }
  return [...names].sort();
}

export async function detectPluginPresenceFlags(
  fs: FileReader,
  pluginSrc: string
): Promise<PluginPresenceFlags> {
  const agentsDir = join(pluginSrc, "agents");
  const hasAgents = await hasAgentFiles(fs, agentsDir);
  const skillsList = await listSkillNames(fs, pluginSrc);
  const hasHooksJson = await fs.fileExists(join(pluginSrc, PLUGIN_HOOKS_RELATIVE));
  const hasMcpJson = await fs.fileExists(join(pluginSrc, PLUGIN_MCP_RELATIVE));
  return { hasAgents, skillsList, hasHooksJson, hasMcpJson };
}

export async function writeSkillTree(
  fs: FileReader & FileWriter,
  pluginName: string,
  pluginSrc: string,
  pluginOut: string
): Promise<number> {
  const skillsSrc = join(pluginSrc, "skills");
  if (!(await fs.fileExists(skillsSrc))) return 0;
  const files = await fs.listFilesRecursive(skillsSrc);
  let count = 0;
  for (const absPath of files) {
    count += await writeSkillFile(fs, pluginName, absPath, skillsSrc, pluginOut);
  }
  return count;
}

async function writeSkillFile(
  fs: FileReader & FileWriter,
  pluginName: string,
  absPath: string,
  skillsSrc: string,
  pluginOut: string
): Promise<number> {
  const relPath = relative(skillsSrc, absPath).replace(/\\/g, "/");
  const destPath = join(pluginOut, "skills", relPath);
  const content = await fs.readFile(absPath);
  if (absPath.endsWith(".md")) {
    assertNoToolsPlaceholder(content, pluginName, relPath);
    const currentFilePluginRelative = `skills/${relPath}`;
    await fs.writeFile(destPath, rewriteRelativeLinks(content, { currentFilePluginRelative }));
  } else {
    await fs.writeFile(destPath, content);
  }
  return 1;
}

export async function resolveVersion(
  fs: FileReader,
  name: string,
  srcEntry: { version?: string } | undefined,
  outDir: string,
  outputManifestRelative: string
): Promise<string> {
  if (srcEntry?.version) return srcEntry.version;
  const manifestPath = join(outDir, "plugins", name, outputManifestRelative);
  const raw = await fs.readFile(manifestPath);
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (typeof manifest.version === "string") return manifest.version;
  throw new InvalidSourceMarketplaceError(
    `plugin '${name}' has no version in marketplace entry or plugin.json`
  );
}

export async function resolveDescription(
  fs: FileReader,
  name: string,
  srcEntry: { description?: string } | undefined,
  outDir: string,
  outputManifestRelative: string
): Promise<string> {
  if (srcEntry?.description) return srcEntry.description;
  const manifestPath = join(outDir, "plugins", name, outputManifestRelative);
  const raw = await fs.readFile(manifestPath);
  const manifest = JSON.parse(raw) as Record<string, unknown>;
  if (typeof manifest.description === "string" && manifest.description.length > 0) {
    return manifest.description;
  }
  throw new InvalidSourceMarketplaceError(
    `plugin '${name}' has no description in marketplace entry or plugin.json`
  );
}
