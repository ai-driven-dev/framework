import { basename, join, relative, resolve } from "node:path";
import {
  FrameworkPlaceholderInPluginError,
  InvalidBuildPathsError,
  InvalidSourceMarketplaceError,
} from "../../../domain/errors.js";
import { stripAgentFrontmatter } from "../../../domain/formats/agent-frontmatter-strip.js";
import { rewriteClaudeRootInJson } from "../../../domain/formats/claude-root-path-rewrite.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../domain/formats/markdown.js";
import { rewriteRelativeLinks } from "../../../domain/formats/relative-link-rewrite.js";
import {
  type BuildPluginResult,
  type FrameworkBuildOptions,
  type FrameworkBuildResult,
  OUT_OF_SCOPE_PLUGIN_SECTIONS,
  OUTPUT_MARKETPLACE_RELATIVE,
  OUTPUT_PLUGIN_MANIFEST_RELATIVE,
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
  SOURCE_MARKETPLACE_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../../domain/models/framework-build.js";
import type { AssetProvider } from "../../../domain/ports/asset-provider.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { JsonSchemaValidator } from "../../../domain/ports/json-schema-validator.js";
import type { Logger } from "../../../domain/ports/logger.js";

const TOOLS_PLACEHOLDER = "@{{TOOLS}}/";

interface SourceMarketplace {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly owner: unknown;
  readonly plugins: readonly SourcePluginEntry[];
  readonly [key: string]: unknown;
}

interface SourcePluginEntry {
  readonly name: string;
  readonly version?: string;
  readonly description?: string;
  readonly [key: string]: unknown;
}

interface PluginPresenceFlags {
  readonly hasAgents: boolean;
  readonly skillsList: readonly string[];
  readonly hasHooksJson: boolean;
  readonly hasMcpJson: boolean;
}

export class FrameworkBuildUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly jsonSchemaValidator: JsonSchemaValidator,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger
  ) {}

  async execute(options: FrameworkBuildOptions): Promise<FrameworkBuildResult> {
    const sourceDir = resolve(options.sourceDir);
    const outDir = resolve(options.outDir);
    this.guardPaths(sourceDir, outDir);
    const sourceMarketplace = await this.readSourceMarketplace(sourceDir);
    await this.fs.deleteDirectory(outDir);
    await this.fs.createDirectory(outDir);
    const builtPlugins: BuildPluginResult[] = [];
    for (const entry of sourceMarketplace.plugins) {
      const plugin = await this.buildPlugin(entry, sourceDir, outDir);
      builtPlugins.push(plugin);
    }
    await this.emitMarketplaceCopilot(sourceMarketplace, builtPlugins, outDir);
    const totalFiles = builtPlugins.reduce((sum, p) => sum + p.filesWritten, 0) + 1;
    return { outDir, plugins: builtPlugins, totalFiles };
  }

  private guardPaths(sourceDir: string, outDir: string): void {
    if (sourceDir === outDir) throw new InvalidBuildPathsError(sourceDir, outDir);
    if (outDir.startsWith(`${sourceDir}/`) || sourceDir.startsWith(`${outDir}/`)) {
      throw new InvalidBuildPathsError(sourceDir, outDir);
    }
  }

  private async readSourceMarketplace(sourceDir: string): Promise<SourceMarketplace> {
    const marketplacePath = join(sourceDir, SOURCE_MARKETPLACE_RELATIVE);
    let raw: string;
    try {
      raw = await this.fs.readFile(marketplacePath);
    } catch {
      throw new InvalidSourceMarketplaceError(`cannot read ${marketplacePath}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new InvalidSourceMarketplaceError(`malformed JSON: ${(err as Error).message}`);
    }
    return this.validateSourceMarketplace(parsed);
  }

  private validateSourceMarketplace(parsed: unknown): SourceMarketplace {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new InvalidSourceMarketplaceError("root must be an object");
    }
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.plugins)) {
      throw new InvalidSourceMarketplaceError("missing 'plugins' array");
    }
    for (const entry of obj.plugins as unknown[]) {
      if (
        !entry ||
        typeof entry !== "object" ||
        typeof (entry as Record<string, unknown>).name !== "string"
      ) {
        throw new InvalidSourceMarketplaceError("each plugin entry must have a 'name' string");
      }
    }
    return obj as unknown as SourceMarketplace;
  }

  private async buildPlugin(
    entry: SourcePluginEntry,
    sourceDir: string,
    outDir: string
  ): Promise<BuildPluginResult> {
    const pluginSrc = join(sourceDir, "plugins", entry.name);
    const pluginOut = join(outDir, "plugins", entry.name);
    if (!(await this.fs.fileExists(pluginSrc))) {
      throw new InvalidSourceMarketplaceError(`plugin '${entry.name}' not found at ${pluginSrc}`);
    }
    await this.validateManifest(pluginSrc);
    let filesWritten = 0;
    filesWritten += await this.buildManifest(pluginSrc, pluginOut);
    filesWritten += await this.buildAgents(entry.name, pluginSrc, pluginOut);
    filesWritten += await this.buildSkills(entry.name, pluginSrc, pluginOut);
    filesWritten += await this.buildHooks(pluginSrc, pluginOut);
    filesWritten += await this.buildMcp(pluginSrc, pluginOut);
    const skippedSections = await this.warnOutOfScopeSections(entry.name, pluginSrc);
    return { name: entry.name, filesWritten, skippedSections };
  }

  private async validateManifest(pluginSrc: string): Promise<void> {
    const manifestPath = join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE);
    const raw = await this.fs.readFile(manifestPath);
    const data = JSON.parse(raw) as unknown;
    this.jsonSchemaValidator.validate(this.assetProvider.loadPluginManifestSchema(), data);
  }

  private async buildManifest(pluginSrc: string, pluginOut: string): Promise<number> {
    const srcManifestPath = join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE);
    const raw = await this.fs.readFile(srcManifestPath);
    const sourceManifest = JSON.parse(raw) as Record<string, unknown>;
    const presence = await this.detectPluginPresenceFlags(pluginSrc);
    const synthesized = this.synthesizePluginManifest(sourceManifest, presence);
    const dest = join(pluginOut, OUTPUT_PLUGIN_MANIFEST_RELATIVE);
    await this.fs.writeFile(dest, `${JSON.stringify(synthesized, null, 2)}\n`);
    return 1;
  }

  private async detectPluginPresenceFlags(pluginSrc: string): Promise<PluginPresenceFlags> {
    const agentsDir = join(pluginSrc, "agents");
    const hasAgents = await this.hasAgentFiles(agentsDir);
    const skillsList = await this.listSkillNames(pluginSrc);
    const hasHooksJson = await this.fs.fileExists(join(pluginSrc, PLUGIN_HOOKS_RELATIVE));
    const hasMcpJson = await this.fs.fileExists(join(pluginSrc, PLUGIN_MCP_RELATIVE));
    return { hasAgents, skillsList, hasHooksJson, hasMcpJson };
  }

  private async hasAgentFiles(agentsDir: string): Promise<boolean> {
    if (!(await this.fs.fileExists(agentsDir))) return false;
    const files = await this.fs.listFilesRecursive(agentsDir);
    return files.some((f) => f.endsWith(PLUGIN_AGENT_INPUT_EXT));
  }

  private async listSkillNames(pluginSrc: string): Promise<readonly string[]> {
    const skillsDir = join(pluginSrc, "skills");
    if (!(await this.fs.fileExists(skillsDir))) return [];
    const files = await this.fs.listFilesRecursive(skillsDir);
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

  private synthesizePluginManifest(
    source: Record<string, unknown>,
    presence: PluginPresenceFlags
  ): Record<string, unknown> {
    const manifest: Record<string, unknown> = {};
    if (typeof source.name === "string") manifest.name = source.name;
    if (typeof source.description === "string") manifest.description = source.description;
    if (typeof source.version === "string") manifest.version = source.version;
    if (typeof source.author === "string" || typeof source.author === "object")
      manifest.author = source.author;
    if (typeof source.homepage === "string") manifest.homepage = source.homepage;
    if (typeof source.repository === "string") manifest.repository = source.repository;
    if (typeof source.license === "string") manifest.license = source.license;
    if (Array.isArray(source.keywords)) manifest.keywords = source.keywords;
    if (presence.hasAgents) manifest.agents = ["./agents"];
    if (presence.skillsList.length > 0)
      manifest.skills = presence.skillsList.map((n) => `./skills/${n}`);
    if (presence.hasHooksJson) manifest.hooks = "./hooks/hooks.json";
    if (presence.hasMcpJson) manifest.mcpServers = "./.mcp.json";
    return manifest;
  }

  private async buildAgents(
    pluginName: string,
    pluginSrc: string,
    pluginOut: string
  ): Promise<number> {
    const agentsSrc = join(pluginSrc, "agents");
    if (!(await this.fs.fileExists(agentsSrc))) return 0;
    const files = await this.fs.listFilesRecursive(agentsSrc);
    let count = 0;
    for (const absPath of files) {
      if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
      count += await this.buildAgentFile(pluginName, absPath, agentsSrc, pluginOut);
    }
    return count;
  }

  private async buildAgentFile(
    pluginName: string,
    absPath: string,
    agentsSrc: string,
    pluginOut: string
  ): Promise<number> {
    const content = await this.fs.readFile(absPath);
    this.assertNoToolsPlaceholder(content, pluginName, relative(agentsSrc, absPath));
    const { frontmatter, body } = parseFrontmatter(content);
    const stripped = stripAgentFrontmatter(frontmatter);
    const outName = basename(absPath);
    const currentFilePluginRelative = `agents/${outName}`;
    const rewrittenBody = rewriteRelativeLinks(body, { currentFilePluginRelative });
    const destPath = join(pluginOut, "agents", outName);
    await this.fs.writeFile(destPath, serializeFrontmatter(stripped, rewrittenBody));
    return 1;
  }

  private async buildSkills(
    pluginName: string,
    pluginSrc: string,
    pluginOut: string
  ): Promise<number> {
    const skillsSrc = join(pluginSrc, "skills");
    if (!(await this.fs.fileExists(skillsSrc))) return 0;
    const files = await this.fs.listFilesRecursive(skillsSrc);
    let count = 0;
    for (const absPath of files) {
      count += await this.buildSkillFile(pluginName, absPath, skillsSrc, pluginOut);
    }
    return count;
  }

  private async buildSkillFile(
    pluginName: string,
    absPath: string,
    skillsSrc: string,
    pluginOut: string
  ): Promise<number> {
    const relPath = relative(skillsSrc, absPath).replace(/\\/g, "/");
    const destPath = join(pluginOut, "skills", relPath);
    const content = await this.fs.readFile(absPath);
    if (absPath.endsWith(".md")) {
      this.assertNoToolsPlaceholder(content, pluginName, relPath);
      const currentFilePluginRelative = `skills/${relPath}`;
      await this.fs.writeFile(
        destPath,
        rewriteRelativeLinks(content, { currentFilePluginRelative })
      );
    } else {
      await this.fs.writeFile(destPath, content);
    }
    return 1;
  }

  private async buildHooks(pluginSrc: string, pluginOut: string): Promise<number> {
    const hooksSrc = join(pluginSrc, "hooks");
    if (!(await this.fs.fileExists(hooksSrc))) return 0;
    const files = await this.fs.listFilesRecursive(hooksSrc);
    let count = 0;
    for (const absPath of files) {
      const relPath = relative(hooksSrc, absPath);
      const destPath = join(pluginOut, "hooks", relPath);
      if (absPath.endsWith(".json")) {
        await this.rewriteJsonFile(absPath, destPath);
      } else {
        await this.fs.writeFile(destPath, await this.fs.readFile(absPath));
      }
      count++;
    }
    return count;
  }

  private async buildMcp(pluginSrc: string, pluginOut: string): Promise<number> {
    const mcpSrc = join(pluginSrc, PLUGIN_MCP_RELATIVE);
    if (!(await this.fs.fileExists(mcpSrc))) return 0;
    const mcpDest = join(pluginOut, PLUGIN_MCP_RELATIVE);
    await this.rewriteJsonFile(mcpSrc, mcpDest);
    return 1;
  }

  private async rewriteJsonFile(srcPath: string, destPath: string): Promise<void> {
    const raw = await this.fs.readFile(srcPath);
    const parsed = JSON.parse(raw) as unknown;
    const rewritten = rewriteClaudeRootInJson(parsed);
    await this.fs.writeFile(destPath, `${JSON.stringify(rewritten, null, 2)}\n`);
  }

  private async warnOutOfScopeSections(
    pluginName: string,
    pluginSrc: string
  ): Promise<readonly string[]> {
    const skipped: string[] = [];
    for (const section of OUT_OF_SCOPE_PLUGIN_SECTIONS) {
      if (await this.fs.fileExists(join(pluginSrc, section))) {
        this.logger.warn(`Skipping ${section}/ in plugin '${pluginName}' (out of scope for MVP1).`);
        skipped.push(section);
      }
    }
    return skipped;
  }

  private assertNoToolsPlaceholder(content: string, pluginName: string, relPath: string): void {
    if (content.includes(TOOLS_PLACEHOLDER)) {
      throw new FrameworkPlaceholderInPluginError(pluginName, relPath);
    }
  }

  private async emitMarketplaceCopilot(
    sourceMarketplace: SourceMarketplace,
    builtPlugins: readonly BuildPluginResult[],
    outDir: string
  ): Promise<void> {
    const pluginEntries = await this.buildCopilotPluginEntries(
      sourceMarketplace,
      builtPlugins,
      outDir
    );
    const marketplaceObj = this.buildCopilotMarketplaceObject(sourceMarketplace, pluginEntries);
    this.jsonSchemaValidator.validate(this.assetProvider.loadMarketplaceSchema(), marketplaceObj);
    const destPath = join(outDir, OUTPUT_MARKETPLACE_RELATIVE);
    await this.fs.writeFile(destPath, `${JSON.stringify(marketplaceObj, null, 2)}\n`);
  }

  private buildCopilotMarketplaceObject(
    source: SourceMarketplace,
    pluginEntries: readonly Record<string, unknown>[]
  ): Record<string, unknown> {
    return {
      name: source.name,
      metadata: {
        description: source.description,
        version: source.version,
        pluginRoot: "./plugins",
      },
      owner: source.owner,
      plugins: pluginEntries,
    };
  }

  private async buildCopilotPluginEntries(
    sourceMarketplace: SourceMarketplace,
    builtPlugins: readonly BuildPluginResult[],
    outDir: string
  ): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [];
    for (const built of builtPlugins) {
      const srcEntry = sourceMarketplace.plugins.find((p) => p.name === built.name);
      const version = await this.resolveVersion(built.name, srcEntry, outDir);
      const description = await this.resolveDescription(built.name, srcEntry, outDir);
      entries.push({ name: built.name, source: built.name, description, version });
    }
    return entries;
  }

  private async resolveVersion(
    name: string,
    srcEntry: SourcePluginEntry | undefined,
    outDir: string
  ): Promise<string> {
    if (srcEntry?.version) return srcEntry.version;
    const manifestPath = join(outDir, "plugins", name, OUTPUT_PLUGIN_MANIFEST_RELATIVE);
    const raw = await this.fs.readFile(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    if (typeof manifest.version === "string") return manifest.version;
    throw new InvalidSourceMarketplaceError(
      `plugin '${name}' has no version in marketplace entry or plugin.json`
    );
  }

  private async resolveDescription(
    name: string,
    srcEntry: SourcePluginEntry | undefined,
    outDir: string
  ): Promise<string> {
    if (srcEntry?.description) return srcEntry.description;
    const manifestPath = join(outDir, "plugins", name, OUTPUT_PLUGIN_MANIFEST_RELATIVE);
    const raw = await this.fs.readFile(manifestPath);
    const manifest = JSON.parse(raw) as Record<string, unknown>;
    if (typeof manifest.description === "string" && manifest.description.length > 0) {
      return manifest.description;
    }
    throw new InvalidSourceMarketplaceError(
      `plugin '${name}' has no description in marketplace entry or plugin.json`
    );
  }
}
