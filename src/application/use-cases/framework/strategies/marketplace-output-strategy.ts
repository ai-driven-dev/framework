import { basename, join, relative } from "node:path";
import { stripAgentFrontmatter } from "../../../../domain/formats/agent-frontmatter-strip.js";
import { rewriteClaudeRootInJson } from "../../../../domain/formats/claude-root-path-rewrite.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../domain/formats/markdown.js";
import { rewriteRelativeLinks } from "../../../../domain/formats/relative-link-rewrite.js";
import {
  type BuildPluginResult,
  OUTPUT_MARKETPLACE_RELATIVE,
  OUTPUT_PLUGIN_MANIFEST_RELATIVE,
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_MCP_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../../../domain/models/framework-build.js";
import type { AssetProvider } from "../../../../domain/ports/asset-provider.js";
import type { FileReader } from "../../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { JsonSchemaValidator } from "../../../../domain/ports/json-schema-validator.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";
import type { BuildOutputStrategy, SourceMarketplace } from "./build-output-strategy.js";
import type { PluginPresenceFlags } from "./marketplace-strategy-helpers.js";
import {
  detectPluginPresenceFlags,
  resolveDescription,
  resolveVersion,
  writeSkillTree,
} from "./marketplace-strategy-helpers.js";

export class MarketplaceOutputStrategy implements BuildOutputStrategy {
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
    const synthesized = this.synthesizePluginManifest(sourceManifest, presence);
    const dest = join(pluginOut, OUTPUT_PLUGIN_MANIFEST_RELATIVE);
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
      count += await this.writeAgentFile(pluginName, absPath, agentsSrc, pluginOut);
    }
    return count;
  }

  private async writeAgentFile(
    pluginName: string,
    absPath: string,
    agentsSrc: string,
    pluginOut: string
  ): Promise<number> {
    const content = await this.fs.readFile(absPath);
    assertNoToolsPlaceholder(content, pluginName, relative(agentsSrc, absPath));
    const { frontmatter, body } = parseFrontmatter(content);
    const stripped = stripAgentFrontmatter(frontmatter);
    const outName = basename(absPath);
    const currentFilePluginRelative = `agents/${outName}`;
    const rewrittenBody = rewriteRelativeLinks(body, { currentFilePluginRelative });
    const destPath = join(pluginOut, "agents", outName);
    await this.fs.writeFile(destPath, serializeFrontmatter(stripped, rewrittenBody));
    return 1;
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
      if (absPath.endsWith(".json")) {
        await this.rewriteJsonFile(absPath, destPath);
      } else {
        await this.fs.writeFile(destPath, await this.fs.readFile(absPath));
      }
      count++;
    }
    return count;
  }

  async writeMcp(pluginName: string, pluginSrc: string, outDir: string): Promise<number> {
    const pluginOut = join(outDir, "plugins", pluginName);
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

  async postBuild(
    sourceMarketplace: SourceMarketplace,
    builtPlugins: readonly BuildPluginResult[],
    outDir: string
  ): Promise<number> {
    await this.emitMarketplaceCopilot(sourceMarketplace, builtPlugins, outDir);
    return 1;
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
    this.jsonSchemaValidator.validate(this.assetProvider.loadSchema("marketplace"), marketplaceObj);
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
      const version = await resolveVersion(
        this.fs,
        built.name,
        srcEntry,
        outDir,
        OUTPUT_PLUGIN_MANIFEST_RELATIVE
      );
      const description = await resolveDescription(
        this.fs,
        built.name,
        srcEntry,
        outDir,
        OUTPUT_PLUGIN_MANIFEST_RELATIVE
      );
      entries.push({ name: built.name, source: built.name, description, version });
    }
    return entries;
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
}
