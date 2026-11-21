import { basename, join, relative } from "node:path";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { AssetProvider } from "../../../../shared/ports/asset-provider.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { SourceMarketplaceRef } from "../../../tools/contract/build-contract.js";
import { rewritePluginRootToken } from "../../../tools/contract/plugin-root-token.js";
import {
  PLUGIN_AGENT_INPUT_EXT,
  PLUGIN_HOOKS_RELATIVE,
  PLUGIN_MCP_RELATIVE,
  SOURCE_PLUGIN_MANIFEST_RELATIVE,
} from "../../domain/canon-format.js";
import {
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../domain/translate.error.js";
import type { FlatPluginWriter, SupportedArtifact } from "../../ports/flat-plugin-writer.js";
import type { JsonSchemaValidator } from "../../ports/json-schema-validator.js";
import type { DiskTarget, PluginTreeSink } from "../../ports/plugin-tree-sink.js";
import { assertNoToolsPlaceholder } from "../shared-plugin-helpers.js";
import { detectPluginPresenceFlags } from "./plugin-source-tree-reader.js";
import { writeSkillTree } from "./write-skill-tree.js";

/**
 * Writes a built plugin tree to disk, in the marketplace layout or the flat one. It holds no
 * state: the layout, the force flag and both directories arrive with every call, so one sink
 * serves any build.
 */
export class DiskSink implements PluginTreeSink {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly jsonSchemaValidator: JsonSchemaValidator,
    private readonly assetProvider: AssetProvider,
    private readonly logger: Logger,
    private readonly flat: FlatPluginWriter
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
      ? this.flat.writeConfig(t, builtPlugins)
      : this.writeCatalog(t, sourceMarketplace, builtPlugins);
  }

  private async validateSourceManifest(pluginSrc: string): Promise<void> {
    const raw = await this.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    this.jsonSchemaValidator.validate(
      this.assetProvider.loadSchema("plugin-manifest"),
      JSON.parse(raw)
    );
  }

  private async writeManifest(t: DiskTarget, pluginName: string, pluginSrc: string) {
    const { contract } = t;
    if (!contract.synthesizeManifest || !contract.manifestFileRelative) return 0;
    const raw = await this.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    const source = asPlainObject(JSON.parse(raw)) ?? {};
    const presence = await detectPluginPresenceFlags(this.fs, pluginSrc);
    const synthesized = contract.synthesizeManifest(source, presence);
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
          ? await this.flat.writeAgent({
              target: t,
              artifact,
              pluginName,
              absPath,
              srcRoot: agentsSrc,
            })
          : await this.writeMarketplaceAgent({ t, artifact, pluginName, absPath, agentsSrc });
    }
    return count;
  }

  private async writeMarketplaceAgent({
    t,
    artifact,
    pluginName,
    absPath,
    agentsSrc,
  }: {
    t: DiskTarget;
    artifact: SupportedArtifact;
    pluginName: string;
    absPath: string;
    agentsSrc: string;
  }): Promise<number> {
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
      return writeSkillTree({
        fs: this.fs,
        pluginName,
        pluginSrc,
        pluginOut,
        transform: artifact.transform,
      });
    }
    const skillsSrc = join(pluginSrc, "skills");
    let count = 0;
    for (const absPath of await this.fs.listFilesRecursive(skillsSrc)) {
      count += await this.flat.writeSkill({
        target: t,
        artifact,
        pluginName,
        absPath,
        srcRoot: skillsSrc,
      });
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
      return this.writeMarketplaceHooks({ t, artifact, pluginName, hooksSrc });
    return this.flat.writeHooks({ target: t, artifact, pluginName, hooksSrc, pluginSrc });
  }

  private async writeMarketplaceHooks({
    t,
    artifact,
    pluginName,
    hooksSrc,
  }: {
    t: DiskTarget;
    artifact: SupportedArtifact;
    pluginName: string;
    hooksSrc: string;
  }): Promise<number> {
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
      return this.flat.writeMcp({ target: t, mcp: { merge, mergeDest }, pluginName, mcpSrc });
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
        await contract.buildMarketplaceEntry({
          name: built.name,
          pluginSrc: join(t.outDir, "plugins", built.name),
          outDir: t.outDir,
          srcEntry: sourceMarketplace.plugins.find((p) => p.name === built.name),
          fs: this.fs,
        })
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
}
