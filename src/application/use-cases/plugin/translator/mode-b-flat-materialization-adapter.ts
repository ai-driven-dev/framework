import type { PluginsCapability } from "../../../../domain/capabilities/plugins-capability.js";
import { CursorProjectScopeUnsupportedError } from "../../../../domain/errors.js";
import type { Manifest } from "../../../../domain/models/manifest.js";
import { Plugin } from "../../../../domain/models/plugin.js";
import type { PluginDistribution } from "../../../../domain/models/plugin-distribution.js";
import type { PluginSource } from "../../../../domain/models/plugin-source.js";
import { PluginTranslator } from "../../../../domain/models/plugin-translator.js";
import type { AiToolId } from "../../../../domain/models/tool-ids.js";
import type { FileWriter } from "../../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../../domain/ports/hasher.js";
import { getToolConfig, isAiTool } from "../../../../domain/tools/registry.js";
import { writePluginFiles } from "../plugin-helpers.js";
import type { PluginTranslationAdapter } from "./plugin-translation-adapter.js";

/**
 * Mode B — Flat materialization.
 *
 * This class is a translator adapter (not a hexagonal port adapter).
 * Materializes plugin content directly into the tool's plugin directory as files on disk.
 * Used by tools without native marketplace support: OpenCode, Cursor (user-scope).
 */
export class ModeBFlatMaterializationAdapter implements PluginTranslationAdapter {
  readonly mode = "flat" as const;

  constructor(
    private readonly fs: FileWriter,
    private readonly hasher: Hasher,
    private readonly homedir: () => string
  ) {}

  async addPlugin(
    dist: PluginDistribution,
    toolId: AiToolId,
    source: PluginSource,
    projectRoot: string,
    manifest: Manifest,
    marketplace: string | undefined,
    docsDir: string
  ): Promise<void> {
    const toolConfig = getToolConfig(toolId);
    if (!isAiTool(toolConfig)) return;
    const caps = toolConfig.capabilities as Record<string, unknown>;
    const pluginsCap = caps.plugins as PluginsCapability;
    if (pluginsCap.mode === "native" && pluginsCap.installScope !== "user") {
      throw new CursorProjectScopeUnsupportedError();
    }
    const { files, componentPaths } = new PluginTranslator(this.hasher).translateWithComponentPaths(
      dist,
      toolConfig,
      docsDir
    );
    if (files.length === 0) return;
    const baseDir = this.resolveBaseDir(pluginsCap, projectRoot);
    await writePluginFiles(files, baseDir, this.fs);
    manifest.addPlugin(
      toolId,
      Plugin.fromDistribution(dist, source, files, componentPaths, marketplace)
    );
  }

  private resolveBaseDir(
    plugins: { resolvePluginsBaseDir: (projectRoot: string, homedir: string) => string },
    projectRoot: string
  ): string {
    return plugins.resolvePluginsBaseDir(projectRoot, this.homedir());
  }
}
