import { join } from "node:path";
import type { PluginDistribution } from "../../../../shared/domain/plugin/plugin-distribution.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { SourceMarketplaceRef } from "../../../tools/contract/build-contract.js";
import { SOURCE_PLUGIN_MANIFEST_RELATIVE } from "../../domain/canon-format.js";
import { translate } from "../../domain/engine.js";
import type { OutputFile } from "../../domain/output-file.js";
import {
  MarketplaceOutDirNotEmptyError,
  OutDirNotDirectoryError,
} from "../../domain/translate.error.js";
import type { DiskSinkDeps } from "../../ports/disk-sink-deps.js";
import type {
  BuiltPlugin,
  DiskTarget,
  PluginTreeSink,
  PluginWritten,
} from "../../ports/plugin-tree-sink.js";
import { assertFlatDestinationFree } from "./flat-collision.js";
import { writeMarketplaceCatalog } from "./marketplace-catalog-writer.js";
import { writePluginHooks, writePluginMcp } from "./plugin-runtime-writer.js";
import { presenceOf, readPluginCanon } from "./plugin-source-tree-reader.js";

/**
 * Writes a built plugin tree to disk, in the marketplace layout or the flat one. It holds no
 * state: the layout, the force flag and both directories arrive with every call, so one sink
 * serves any build.
 */
export class DiskSink implements PluginTreeSink {
  constructor(private readonly deps: DiskSinkDeps) {}

  /**
   * Marketplace never wipes outDir: a build only ever writes the canonical paths it produces, so
   * anything else already there survives. A non-empty outDir is refused unless --force, naming
   * the directory so the message says exactly what to pass --force at. Flat only requires that
   * outDir is a directory already.
   */
  async prepare(t: DiskTarget): Promise<void> {
    if (t.mode === "flat") {
      const exists = await this.deps.fs.fileExists(t.outDir);
      if (!exists || !(await this.deps.fs.isDirectory(t.outDir))) {
        throw new OutDirNotDirectoryError(t.outDir);
      }
      return;
    }
    if (await this.deps.fs.fileExists(t.outDir)) {
      const entries = await this.deps.fs.listDirectory(t.outDir);
      if (entries.length > 0 && !t.force) throw new MarketplaceOutDirNotEmptyError(t.outDir);
    }
    await this.deps.fs.createDirectory(t.outDir);
  }

  /** Writes one plugin's manifest, agents, skills, hooks and MCP; returns the files written. */
  async writePlugin(t: DiskTarget, pluginName: string, pluginSrc: string): Promise<PluginWritten> {
    await this.validateSourceManifest(pluginSrc);
    const plugin = { name: pluginName, src: pluginSrc };
    const canon = await readPluginCanon(this.deps.fs, plugin, this.deps.canonFormat);
    const manifest = t.mode === "flat" ? 0 : await this.writeManifest(t, canon, pluginSrc);
    const { files, hooks, mcp, warnings } = translate(canon, {
      kind: "build",
      contract: t.contract,
      mode: t.mode,
      outDir: t.outDir,
    });
    for (const warning of warnings) this.deps.logger.warn(warning);
    for (const file of files) await this.writeBuilt(t, plugin.name, file);
    const folded =
      (await writePluginHooks(this.deps, t, { name: plugin.name, hooks })) +
      (await writePluginMcp(this.deps, t, { name: plugin.name, mcp }));
    return { files: manifest + files.length + folded, declaredMcp: mcp?.declared ?? null };
  }

  /** Once every plugin is built: the marketplace catalog, or the flat config artefact. Returns
   * the extra files written. */
  async finish(
    t: DiskTarget,
    sourceMarketplace: SourceMarketplaceRef,
    builtPlugins: readonly BuiltPlugin[]
  ): Promise<number> {
    return t.mode === "flat"
      ? this.deps.flat.writeConfig(t, builtPlugins)
      : writeMarketplaceCatalog(this.deps, t, { sourceMarketplace, builtPlugins });
  }

  private async validateSourceManifest(pluginSrc: string): Promise<void> {
    const raw = await this.deps.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    this.deps.jsonSchemaValidator.validate(
      this.deps.assetProvider.loadSchema("plugin-manifest"),
      JSON.parse(raw)
    );
  }

  /** A built file, at its place under outDir. A flat build refuses one a first build wrote. */
  private async writeBuilt(t: DiskTarget, pluginName: string, file: OutputFile): Promise<void> {
    const destPath = join(t.outDir, file.relativePath);
    if (t.mode === "flat")
      await assertFlatDestinationFree(this.deps.fs, { target: t, destPath, pluginName });
    await this.deps.fs.writeFile(destPath, file.content);
  }

  private async writeManifest(t: DiskTarget, canon: PluginDistribution, pluginSrc: string) {
    const { contract } = t;
    if (!contract.synthesizeManifest || !contract.manifestFileRelative) return 0;
    const raw = await this.deps.fs.readFile(join(pluginSrc, SOURCE_PLUGIN_MANIFEST_RELATIVE));
    const source = asPlainObject(JSON.parse(raw)) ?? {};
    const synthesized = contract.synthesizeManifest(source, presenceOf(canon));
    if (contract.manifestSchemaName) {
      this.deps.jsonSchemaValidator.validate(
        this.deps.assetProvider.loadSchema(contract.manifestSchemaName),
        synthesized
      );
    }
    const dest = join(t.outDir, "plugins", canon.manifest.name, contract.manifestFileRelative);
    await this.deps.fs.writeFile(dest, `${JSON.stringify(synthesized, null, 2)}\n`);
    return 1;
  }
}
