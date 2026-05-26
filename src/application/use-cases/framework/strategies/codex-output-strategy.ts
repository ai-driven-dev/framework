import { basename, join, relative } from "node:path";
import { codexAgentMarkdownToToml } from "../../../../domain/formats/codex-agent-toml.js";
import {
  OUTPUT_CODEX_AGENTS_DIR,
  OUTPUT_CODEX_MANIFEST_RELATIVE,
  OUTPUT_CODEX_MARKETPLACE_RELATIVE,
} from "../../../../domain/formats/codex-paths.js";
import {
  type BuildPluginResult,
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../../../domain/models/framework-build.js";
import type { AssetProvider } from "../../../../domain/ports/asset-provider.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { JsonSchemaValidator } from "../../../../domain/ports/json-schema-validator.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";
import type {
  BuildOutputStrategy,
  SourceMarketplace,
  SourcePluginEntry,
} from "./build-output-strategy.js";
import type { PluginPresenceFlags } from "./marketplace-strategy-helpers.js";
import {
  detectPluginPresenceFlags,
  resolveDescription,
  resolveVersion,
  writeSkillTree,
} from "./marketplace-strategy-helpers.js";

export class CodexOutputStrategy implements BuildOutputStrategy {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly jsonSchemaValidator: JsonSchemaValidator,
    private readonly assetProvider: AssetProvider
  ) {}

  async preBuild(outDir: string): Promise<void> {
    await this.fs.deleteDirectory(outDir);
    await this.fs.createDirectory(outDir);
  }

  async writePluginManifest(
    pluginName: string,
    pluginSrc: string,
    outDir: string
  ): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
    const srcManifestPath = join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE);
    const raw = await this.fs.readFile(srcManifestPath);
    const sourceManifest = JSON.parse(raw) as Record<string, unknown>;
    const presence = await detectPluginPresenceFlags(this.fs, pluginSrc);
    const synthesized = this.synthesizeCodexPluginManifest(sourceManifest, presence);
    this.jsonSchemaValidator.validate(
      this.assetProvider.loadCodexPluginManifestSchema(),
      synthesized
    );
    const dest = join(pluginOut, OUTPUT_CODEX_MANIFEST_RELATIVE);
    await this.fs.writeFile(dest, `${JSON.stringify(synthesized, null, 2)}\n`);
    return 1;
  }

  async writeAgents(pluginName: string, pluginSrc: string, outDir: string): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
    const agentsSrc = join(pluginSrc, "agents");
    if (!(await this.fs.fileExists(agentsSrc))) return 0;
    const files = await this.fs.listFilesRecursive(agentsSrc);
    let count = 0;
    for (const absPath of files) {
      if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
      count += await this.writeCodexAgentFile(pluginName, absPath, agentsSrc, pluginOut);
    }
    return count;
  }

  async writeSkills(pluginName: string, pluginSrc: string, outDir: string): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
    return writeSkillTree(this.fs, pluginName, pluginSrc, pluginOut);
  }

  async writeHooks(pluginName: string, pluginSrc: string, outDir: string): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
    const hooksSrc = join(pluginSrc, "hooks");
    if (!(await this.fs.fileExists(hooksSrc))) return 0;
    const files = await this.fs.listFilesRecursive(hooksSrc);
    let count = 0;
    for (const absPath of files) {
      const relPath = relative(hooksSrc, absPath);
      const destPath = join(pluginOut, "hooks", relPath);
      // Byte-for-byte copy — Codex expands ${CLAUDE_PLUGIN_ROOT} natively (D-7)
      await this.fs.writeFile(destPath, await this.fs.readFile(absPath));
      count++;
    }
    return count;
  }

  async writeMcp(pluginName: string, pluginSrc: string, outDir: string): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
    const mcpSrc = join(pluginSrc, PLUGIN_MCP_RELATIVE);
    if (!(await this.fs.fileExists(mcpSrc))) return 0;
    // Byte-for-byte copy — Codex expands ${CLAUDE_PLUGIN_ROOT} natively (D-7)
    await this.fs.writeFile(join(pluginOut, PLUGIN_MCP_RELATIVE), await this.fs.readFile(mcpSrc));
    return 1;
  }

  async postBuild(
    sourceMarketplace: SourceMarketplace,
    builtPlugins: readonly BuildPluginResult[],
    outDir: string
  ): Promise<number> {
    const pluginEntries = await this.buildCodexMarketplaceEntries(
      sourceMarketplace,
      builtPlugins,
      outDir
    );
    const marketplaceObj = this.buildCodexMarketplaceObject(sourceMarketplace, pluginEntries);
    this.jsonSchemaValidator.validate(
      this.assetProvider.loadClaudeMarketplaceSchema(),
      marketplaceObj
    );
    const destPath = join(outDir, OUTPUT_CODEX_MARKETPLACE_RELATIVE);
    await this.fs.writeFile(destPath, `${JSON.stringify(marketplaceObj, null, 2)}\n`);
    return 1;
  }

  private async writeCodexAgentFile(
    pluginName: string,
    absPath: string,
    agentsSrc: string,
    pluginOut: string
  ): Promise<number> {
    const content = await this.fs.readFile(absPath);
    assertNoToolsPlaceholder(content, pluginName, relative(agentsSrc, absPath));
    const fileBaseName = basename(absPath);
    const tomlContent = codexAgentMarkdownToToml(content, pluginName, fileBaseName);
    const outName = fileBaseName.replace(/\.md$/, ".toml");
    const destPath = join(pluginOut, OUTPUT_CODEX_AGENTS_DIR, outName);
    await this.fs.writeFile(destPath, tomlContent);
    return 1;
  }

  private synthesizeCodexPluginManifest(
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
    // agents field intentionally omitted (D-8): Codex plugin schema does not support it
    if (presence.skillsList.length > 0)
      manifest.skills = presence.skillsList.map((n) => `./skills/${n}`);
    if (presence.hasHooksJson) manifest.hooks = `./${PLUGIN_HOOKS_RELATIVE}`;
    if (presence.hasMcpJson) manifest.mcpServers = `./${PLUGIN_MCP_RELATIVE}`;
    return manifest;
  }

  private async buildCodexMarketplaceEntries(
    sourceMarketplace: SourceMarketplace,
    builtPlugins: readonly BuildPluginResult[],
    outDir: string
  ): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [];
    for (const built of builtPlugins) {
      const srcEntry = sourceMarketplace.plugins.find((p) => p.name === built.name);
      const entry = await this.buildCodexMarketplaceEntry(built.name, srcEntry, outDir);
      entries.push(entry);
    }
    return entries;
  }

  private async buildCodexMarketplaceEntry(
    name: string,
    srcEntry: SourcePluginEntry | undefined,
    outDir: string
  ): Promise<Record<string, unknown>> {
    const { version, description } = await this.resolveEntryCore(name, srcEntry, outDir);
    const entry: Record<string, unknown> = {
      name,
      source: `./plugins/${name}`,
      description,
      version,
    };
    if (typeof srcEntry?.strict === "boolean") entry.strict = srcEntry.strict;
    if (typeof srcEntry?.recommended === "boolean") entry.recommended = srcEntry.recommended;
    return entry;
  }

  private async resolveEntryCore(
    name: string,
    srcEntry: SourcePluginEntry | undefined,
    outDir: string
  ): Promise<{ version: string; description: string }> {
    const args = [this.fs, name, srcEntry, outDir, OUTPUT_CODEX_MANIFEST_RELATIVE] as const;
    const version = await resolveVersion(...args);
    const description = await resolveDescription(...args);
    return { version, description };
  }

  private buildCodexMarketplaceObject(
    source: SourceMarketplace,
    pluginEntries: readonly Record<string, unknown>[]
  ): Record<string, unknown> {
    const obj: Record<string, unknown> = { name: source.name };
    if (typeof source.version === "string") obj.version = source.version;
    if (typeof source.description === "string") obj.description = source.description;
    if (source.owner !== undefined) obj.owner = source.owner;
    obj.plugins = pluginEntries;
    return obj;
  }
}
