import { basename, dirname, join, relative } from "node:path";
import {
  FlatMergeTargetNotJsonError,
  FlatTargetExistsError,
  MarketplaceOutDirNotEmptyError,
  McpConfigError,
  OutDirNotDirectoryError,
} from "../../../../shared/domain/errors.js";
import { parseFrontmatter, serializeFrontmatter } from "../../../../shared/domain/markdown.js";
import { flatMcpKeyPrefix } from "../../../../shared/domain/materialization/flat-paths.js";
import { rewritePluginRootInJson } from "../../../../shared/domain/materialization/plugin-root-path-rewrite.js";
import { rewriteRelativeLinks } from "../../../../shared/domain/materialization/relative-link-rewrite.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type {
  ArtifactContract,
  PluginPresence,
  SourceMarketplaceRef,
  ToolBuildContract,
} from "../../../tools/contract/build-contract.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../domain/canon-format.js";
import { flatHooksBridgeFile } from "../../domain/flat-layout.js";
import { rewritePluginRootToken } from "../../domain/formats/plugin-root-token-rewrite.js";
import type { JsonSchemaValidator } from "../../ports/json-schema-validator.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";
import { detectPluginPresenceFlags } from "./plugin-source-tree-reader.js";
import { writeSkillTree } from "./write-skill-tree.js";

type SupportedArtifact = Extract<ArtifactContract, { supported: true }>;
/** What a flat MCP merge needs of its artifact: the merge, and where its file lives. */
type FlatMcpTarget = Required<Pick<SupportedArtifact, "merge" | "mergeDest">>;

/** What a build writes and how: the tool's contract, the layout, and whether it may overwrite. */
export interface DiskLayout {
  readonly contract: ToolBuildContract;
  readonly mode: FrameworkBuildMode;
  readonly force: boolean;
}

/** A layout aimed at one source tree and one output directory, both absolute. */
export interface DiskTarget extends DiskLayout {
  readonly sourceDir: string;
  readonly outDir: string;
}

function parsePluginMcp(pluginName: string, content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new McpConfigError(
      `Cannot parse plugin '${pluginName}' MCP config: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Writes a built plugin tree to disk, in the marketplace layout or the flat one. It holds no
 * state: the layout, the force flag and both directories arrive with every call, so one sink
 * serves any build.
 */
export class DiskSink {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly jsonSchemaValidator: JsonSchemaValidator,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger
  ) {}

  /**
   * Marketplace never wipes outDir: a build only ever writes the canonical paths it produces, so
   * anything else already there survives. A non-empty outDir is refused unless --force, naming
   * the directory so the message says exactly what to pass --force at. Flat only requires that
   * outDir is a directory already.
   */
  async prepare(t: DiskTarget): Promise<void> {
    if (t.mode === "flat") {
      const exists = await this.fs.fileExists(t.outDir);
      if (!exists || !(await this.fs.isDirectory(t.outDir))) {
        throw new OutDirNotDirectoryError(t.outDir);
      }
      return;
    }
    if (await this.fs.fileExists(t.outDir)) {
      const entries = await this.fs.listDirectory(t.outDir);
      if (entries.length > 0 && !t.force) throw new MarketplaceOutDirNotEmptyError(t.outDir);
    }
    await this.fs.createDirectory(t.outDir);
  }

  /** Writes one plugin's manifest, agents, skills, hooks and MCP; returns the files written. */
  async writePlugin(t: DiskTarget, pluginName: string, pluginSrc: string): Promise<number> {
    await this.validateSourceManifest(pluginSrc);
    const flat = t.mode === "flat";
    let count = 0;
    count += flat ? 0 : await this.writeManifest(t, pluginName, pluginSrc);
    count += await this.writeAgents(t, pluginName, pluginSrc);
    count += await this.writeSkills(t, pluginName, pluginSrc);
    count += await this.writeHooks(t, pluginName, pluginSrc);
    count += await this.writeMcp(t, pluginName, pluginSrc);
    return count;
  }

  /** Once every plugin is built: the marketplace catalog, or the flat config artefact. Returns
   * the extra files written. */
  async finish(
    t: DiskTarget,
    sourceMarketplace: SourceMarketplaceRef,
    builtPlugins: readonly { name: string }[]
  ): Promise<number> {
    return t.mode === "flat"
      ? this.writeFlatConfig(t, builtPlugins)
      : this.writeCatalog(t, sourceMarketplace, builtPlugins);
  }

  private async validateSourceManifest(pluginSrc: string): Promise<void> {
    const raw = await this.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    this.jsonSchemaValidator.validate(
      this.assetProvider.loadSchema("plugin-manifest"),
      JSON.parse(raw) as unknown
    );
  }

  private async writeManifest(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const { contract } = t;
    if (!contract.synthesizeManifest || !contract.manifestFileRelative) return 0;
    const raw = await this.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    const source = JSON.parse(raw) as Record<string, unknown>;
    const presence = await detectPluginPresenceFlags(this.fs, pluginSrc);
    const synthesized = contract.synthesizeManifest(source, presence as PluginPresence);
    if (contract.manifestSchemaName) {
      this.jsonSchemaValidator.validate(
        this.assetProvider.loadSchema(contract.manifestSchemaName),
        synthesized
      );
    }
    const dest = join(t.outDir, "plugins", pluginName, contract.manifestFileRelative);
    await this.fs.writeFile(dest, `${JSON.stringify(synthesized, null, 2)}\n`);
    return 1;
  }

  private async writeAgents(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const artifact = t.contract.artifacts.agents;
    if (!artifact.supported) return 0;
    const agentsSrc = join(pluginSrc, "agents");
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(agentsSrc)) {
      if (!absPath.endsWith(PLUGIN_AGENT_INPUT_EXT)) continue;
      count +=
        t.mode === "flat"
          ? await this.writeFlatAgent(t, artifact, pluginName, absPath, agentsSrc)
          : await this.writeMarketplaceAgent(t, artifact, pluginName, absPath, agentsSrc);
    }
    return count;
  }

  private async writeMarketplaceAgent(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    absPath: string,
    agentsSrc: string
  ): Promise<number> {
    const content = await this.fs.readFile(absPath);
    const agentBaseName = basename(absPath);
    assertNoToolsPlaceholder(content, pluginName, relative(agentsSrc, absPath));
    const destRelPath = artifact.path(pluginName, `agents/${agentBaseName}`);
    const outContent = artifact.transform
      ? artifact.transform(content, pluginName, agentBaseName)
      : content;
    await this.fs.writeFile(join(t.outDir, "plugins", pluginName, destRelPath), outContent);
    return 1;
  }

  private async writeSkills(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const artifact = t.contract.artifacts.skills;
    if (!artifact.supported) return 0;
    if (t.mode === "marketplace") {
      const pluginOut = join(t.outDir, "plugins", pluginName);
      return writeSkillTree(this.fs, pluginName, pluginSrc, pluginOut, artifact.transform);
    }
    const skillsSrc = join(pluginSrc, "skills");
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(skillsSrc)) {
      count += await this.writeFlatSkill(t, artifact, pluginName, absPath, skillsSrc);
    }
    return count;
  }

  private async writeHooks(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const artifact = t.contract.artifacts.hooks;
    const hooksSrc = join(pluginSrc, t.mode === "flat" ? PLUGIN_HOOKS_RELATIVE : "hooks");
    if (!artifact.supported) {
      if (t.mode === "flat" && (await this.fs.fileExists(hooksSrc))) {
        this.logger.warn(
          `Skipping hooks/ in plugin '${pluginName}' (hooks not supported for this target).`
        );
      }
      return 0;
    }
    if (!(await this.fs.fileExists(hooksSrc))) return 0;
    if (t.mode === "marketplace")
      return this.writeMarketplaceHooks(t, artifact, pluginName, hooksSrc);
    const jsonCount = artifact.skipHooksJson
      ? await this.writeHooksBridgeIfDeclared(t, artifact, pluginName, hooksSrc)
      : await this.writeFlatHooksJson(t, artifact, pluginName, hooksSrc);
    return jsonCount + (await this.writeFlatHooksScripts(t, artifact, pluginName, pluginSrc));
  }

  private async writeMarketplaceHooks(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string
  ): Promise<number> {
    const pluginOut = join(t.outDir, "plugins", pluginName);
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(hooksSrc)) {
      const relPath = relative(hooksSrc, absPath).replace(/\\/g, "/");
      const content = await this.fs.readFile(absPath);
      const outContent = this.applyPluginRootToken(
        t,
        artifact.transform && absPath.endsWith(".json")
          ? artifact.transform(content, pluginName, basename(absPath))
          : content
      );
      const script = artifact.script?.(`hooks/${relPath}`, outContent) ?? outContent;
      await this.fs.writeFile(join(pluginOut, "hooks", relPath), script);
      count++;
    }
    return count;
  }

  private async writeMcp(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const artifact = t.contract.artifacts.mcp;
    if (!artifact.supported) return 0;
    const mcpSrc = join(pluginSrc, PLUGIN_MCP_RELATIVE);
    if (t.mode === "flat") {
      const { merge, mergeDest } = artifact;
      if (!merge || !mergeDest) return 0;
      if (!(await this.fs.fileExists(mcpSrc))) return 0;
      return this.writeFlatMcp(t, { merge, mergeDest }, pluginName, mcpSrc);
    }
    if (!(await this.fs.fileExists(mcpSrc))) return 0;
    const content = await this.fs.readFile(mcpSrc);
    const transformed = artifact.transform
      ? artifact.transform(content, pluginName, PLUGIN_MCP_RELATIVE)
      : content;
    await this.fs.writeFile(
      join(t.outDir, "plugins", pluginName, PLUGIN_MCP_RELATIVE),
      this.applyPluginRootToken(t, transformed)
    );
    return 1;
  }

  private applyPluginRootToken(t: DiskTarget, content: string): string {
    if (!t.contract.pluginRootToken) return content;
    return rewritePluginRootToken(content, t.contract.pluginRootToken);
  }

  private async writeCatalog(
    t: DiskTarget,
    sourceMarketplace: SourceMarketplaceRef,
    builtPlugins: readonly { name: string }[]
  ): Promise<number> {
    const { contract } = t;
    if (!contract.buildMarketplaceCatalog || !contract.buildMarketplaceEntry) return 0;
    const entries: Record<string, unknown>[] = [];
    for (const built of builtPlugins) {
      entries.push(
        await contract.buildMarketplaceEntry(
          built.name,
          join(t.outDir, "plugins", built.name),
          t.outDir,
          sourceMarketplace.plugins.find((p) => p.name === built.name),
          this.fs
        )
      );
    }
    const { catalog, schemaName, destRelPath } = await contract.buildMarketplaceCatalog(
      sourceMarketplace,
      entries,
      this.fs
    );
    if (schemaName) {
      this.jsonSchemaValidator.validate(this.assetProvider.loadSchema(schemaName), catalog);
    }
    await this.fs.writeFile(join(t.outDir, destRelPath), `${JSON.stringify(catalog, null, 2)}\n`);
    return 1;
  }

  private async writeFlatConfig(
    t: DiskTarget,
    builtPlugins: readonly { name: string }[]
  ): Promise<number> {
    const step = t.contract.configArtifact;
    if (!step) return 0;
    const names = builtPlugins.map((p) => p.name);
    const files = step.emit({
      builtPlugins: names,
      pluginMcp: await this.readPluginMcp(t, names),
      existing: await this.readEach(step.reads(names), (relPath) => join(t.outDir, relPath)),
      present: await this.presentOf(step.probes(names), t.outDir),
      assets: new Map(
        step.assets.names.map((name) => [
          name,
          this.assetProvider.loadConfigAsset(step.assets.tool, name),
        ])
      ),
    });
    for (const file of files) await this.fs.writeFile(join(t.outDir, file.path), file.content);
    return files.length;
  }

  /** Each built plugin's `.mcp.json`, its plugin-root paths already resolved into the output, as
   * the per-plugin MCP merge resolves them. */
  private async readPluginMcp(
    t: DiskTarget,
    names: readonly string[]
  ): Promise<ReadonlyMap<string, string>> {
    const raw = await this.readEach(names, (name) =>
      join(t.sourceDir, "plugins", name, PLUGIN_MCP_RELATIVE)
    );
    const resolved = new Map<string, string>();
    for (const [name, content] of raw) {
      const rewritten = rewritePluginRootInJson(parsePluginMcp(name, content), (suffix) =>
        this.resolveClaudeRootAbsolute(t, suffix, name)
      );
      resolved.set(name, JSON.stringify(rewritten));
    }
    return resolved;
  }

  private async presentOf(relPaths: readonly string[], outDir: string): Promise<Set<string>> {
    const present = new Set<string>();
    for (const relPath of relPaths) {
      if (await this.fs.fileExists(join(outDir, relPath))) present.add(relPath);
    }
    return present;
  }

  /** Each key's file content, for the keys whose file exists. */
  private async readEach(
    keys: readonly string[],
    pathOf: (key: string) => string
  ): Promise<ReadonlyMap<string, string>> {
    const found = new Map<string, string>();
    for (const key of keys) {
      const path = pathOf(key);
      if (await this.fs.fileExists(path)) found.set(key, await this.fs.readFile(path));
    }
    return found;
  }

  private async writeFlatAgent(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    absPath: string,
    agentsSrc: string
  ): Promise<number> {
    const agentBaseName = basename(absPath);
    const srcRelPath = `agents/${relative(agentsSrc, absPath).replace(/\\/g, "/")}`;
    const content = await this.fs.readFile(absPath);
    assertNoToolsPlaceholder(content, pluginName, srcRelPath);
    const flatRelPath = flatAgentPath(artifact, pluginName, agentBaseName);
    const destPath = join(t.outDir, flatRelPath);
    await this.checkCollision(t, destPath, pluginName);
    const outContent = artifact.transform
      ? artifact.transform(content, pluginName, agentBaseName)
      : this.rewriteAgentForFlat(t, content, flatRelPath, pluginName);
    await this.fs.writeFile(destPath, outContent);
    return 1;
  }

  private rewriteAgentForFlat(
    t: DiskTarget,
    content: string,
    flatRelPath: string,
    pluginName: string
  ): string {
    const { frontmatter, body } = parseFrontmatter(content);
    const rewrittenBody = rewriteRelativeLinks(body, {
      currentFilePluginRelative: flatRelPath,
      resolveTargetPath: (rel) => resolveTargetForMd(t.contract, pluginName, rel),
    });
    return serializeFrontmatter(frontmatter, rewrittenBody);
  }

  private async writeFlatSkill(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    absPath: string,
    skillsSrc: string
  ): Promise<number> {
    const relFromSkills = relative(skillsSrc, absPath).replace(/\\/g, "/");
    const flatRelPath = artifact.path(pluginName, `skills/${relFromSkills}`);
    const destPath = join(t.outDir, flatRelPath);
    await this.checkCollision(t, destPath, pluginName);
    const content = await this.fs.readFile(absPath);
    if (!absPath.endsWith(".md")) {
      await this.fs.writeFile(destPath, content);
      return 1;
    }
    assertNoToolsPlaceholder(content, pluginName, relFromSkills);
    const rewritten = rewriteRelativeLinks(content, {
      currentFilePluginRelative: flatRelPath,
      resolveTargetPath: (rel) => resolveTargetForMd(t.contract, pluginName, rel),
    });
    const outContent =
      artifact.rewriteSkillName && basename(absPath) === "SKILL.md"
        ? rewriteSkillNameFrontmatter(rewritten, flatRelPath)
        : rewritten;
    await this.fs.writeFile(destPath, outContent);
    return 1;
  }

  private async writeFlatHooksJson(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string
  ): Promise<number> {
    const file = artifact.hooksFile;
    if (file === undefined) return 0;
    const destPath = join(t.outDir, file.path(pluginName));
    if (!file.shared) await this.checkCollision(t, destPath, pluginName);
    const existing =
      file.shared && (await this.fs.fileExists(destPath)) ? await this.fs.readFile(destPath) : null;
    if (existing !== null) assertParsableJson(existing, t.outDir, destPath);
    const raw = await this.fs.readFile(hooksSrc);
    const { content, warnings } = file.merge(
      existing,
      raw,
      pluginName,
      (pluginPath) => `./${resolveSuffixToFlatPath(t.contract, pluginPath, pluginName)}`
    );
    for (const w of warnings) this.logger.warn(w);
    await this.fs.writeFile(destPath, content);
    return 1;
  }

  // OpenCode reads no hooks.json, so a plugin's declared hooks have no trigger there unless a
  // generated bridge replaces the manifest a native host would read. Raw content only: the
  // bridge resolves its own scripts from its own `import.meta.url`, never from an outDir-relative
  // path this sink would otherwise rewrite for it.
  private async writeHooksBridgeIfDeclared(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    hooksSrc: string
  ): Promise<number> {
    const bridge = artifact.hooksBridge;
    if (!bridge) return 0;
    const shipsItsOwn = await this.fs.fileExists(join(dirname(hooksSrc), bridge.skipIfSourceHas));
    const generated = flatHooksBridgeFile(
      bridge,
      await this.fs.readFile(hooksSrc),
      pluginName,
      shipsItsOwn
    );
    if (generated === null) return 0;
    const destPath = join(t.outDir, generated.relativePath);
    await this.checkCollision(t, destPath, pluginName);
    await this.fs.writeFile(destPath, generated.content);
    return 1;
  }

  private async writeFlatHooksScripts(
    t: DiskTarget,
    artifact: SupportedArtifact,
    pluginName: string,
    pluginSrc: string
  ): Promise<number> {
    const hooksDir = join(pluginSrc, "hooks");
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(hooksDir)) {
      if (absPath.endsWith("hooks.json")) continue;
      const pluginPath = `hooks/${relative(hooksDir, absPath).replace(/\\/g, "/")}`;
      const destPath = join(t.outDir, artifact.path(pluginName, pluginPath));
      await this.checkCollision(t, destPath, pluginName);
      const content = await this.fs.readFile(absPath);
      await this.fs.writeFile(destPath, artifact.script?.(pluginPath, content) ?? content);
      count++;
    }
    return count;
  }

  private async writeFlatMcp(
    t: DiskTarget,
    target: FlatMcpTarget,
    pluginName: string,
    mcpSrc: string
  ): Promise<number> {
    const parsed = JSON.parse(await this.fs.readFile(mcpSrc)) as {
      mcpServers?: Record<string, unknown>;
    };
    const prefix = flatMcpKeyPrefix(pluginName);
    const prefixed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.mcpServers ?? {})) {
      prefixed[`${prefix}${key}`] = rewritePluginRootInJson(value, (suffix) =>
        this.resolveClaudeRootAbsolute(t, suffix, pluginName)
      );
    }
    const mcpDest = target.mergeDest(t.outDir);
    const existingContent = (await this.fs.fileExists(mcpDest))
      ? await this.fs.readFile(mcpDest)
      : null;
    const { mergedContent, collisions } = target.merge(existingContent, prefixed, t.force);
    if (collisions.length > 0) throw new FlatTargetExistsError(mcpDest, pluginName);
    await this.fs.writeFile(mcpDest, mergedContent);
    return 1;
  }

  // "/"-joined and separator-normalized: this value is embedded into written JSON content, and
  // on Windows `outDir` is backslash-native — JSON.stringify then escapes each backslash, so a
  // reader comparing against the plain outDir string never finds it as a substring.
  private resolveClaudeRootAbsolute(t: DiskTarget, suffix: string, pluginName: string): string {
    const normalizedOut = t.outDir.replace(/\\/g, "/");
    return `${normalizedOut}/${resolveSuffixToFlatPath(t.contract, suffix, pluginName)}`;
  }

  private async checkCollision(t: DiskTarget, destPath: string, pluginName: string) {
    if (!t.force && (await this.fs.fileExists(destPath))) {
      throw new FlatTargetExistsError(destPath, pluginName);
    }
  }
}

/** Where an agent lands, whatever folder under `agents/` holds it: the one path its writer, a
 * command naming it and a link to it all resolve to. */
function flatAgentPath(artifact: SupportedArtifact, pluginName: string, agentFile: string) {
  return artifact.path(pluginName, `agents/${basename(agentFile)}`);
}

function assertParsableJson(content: string, outDir: string, destPath: string): void {
  try {
    JSON.parse(content);
  } catch (err) {
    const shown = relative(outDir, destPath).replace(/\\/g, "/");
    throw new FlatMergeTargetNotJsonError(shown, (err as Error).message);
  }
}

function rewriteSkillNameFrontmatter(content: string, flatRelPath: string): string {
  const { frontmatter, body } = parseFrontmatter(content);
  const parts = flatRelPath.split("/");
  const skillFolder = parts[parts.length - 2];
  if (!skillFolder) return content;
  return serializeFrontmatter({ ...frontmatter, name: skillFolder }, body);
}

function resolveSuffixToFlatPath(
  contract: ToolBuildContract,
  suffix: string,
  pluginName: string
): string {
  const art = contract.artifacts;
  if (suffix.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, suffix);
  }
  if (suffix.startsWith("skills/") && art.skills.supported) {
    return art.skills.path(pluginName, `skills/${suffix.slice("skills/".length)}`);
  }
  if (suffix.startsWith("hooks/") && art.hooks.supported) {
    return art.hooks.path(pluginName, `hooks/${suffix.slice("hooks/".length)}`);
  }
  return suffix;
}

function resolveTargetForMd(
  contract: ToolBuildContract,
  pluginName: string,
  pluginRelPath: string
): string {
  const art = contract.artifacts;
  if (pluginRelPath.startsWith("agents/") && art.agents.supported) {
    return flatAgentPath(art.agents, pluginName, pluginRelPath);
  }
  if (pluginRelPath.startsWith("skills/") && art.skills.supported) {
    return art.skills.path(pluginName, pluginRelPath);
  }
  return pluginRelPath;
}
