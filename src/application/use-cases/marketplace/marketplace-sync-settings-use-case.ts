import { resolve } from "node:path";
import type { MarketplaceSettings } from "../../../domain/capabilities/plugins-capability.js";
import type { Manifest } from "../../../domain/models/manifest.js";
import type { Marketplace } from "../../../domain/models/marketplace.js";
import { marketplaceCacheDir } from "../../../domain/models/paths.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import type { ToolId } from "../../../domain/models/tool-ids.js";
import type { FileReader } from "../../../domain/ports/file-reader.js";
import type { FileWriter } from "../../../domain/ports/file-writer.js";
import type { Hasher } from "../../../domain/ports/hasher.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { PluginCatalogRepository } from "../../../domain/ports/plugin-catalog-repository.js";
import { getToolConfig, isAiTool } from "../../../domain/tools/registry.js";

export interface MarketplaceSyncSettingsOptions {
  projectRoot: string;
}

export interface MarketplaceSyncSettingsResult {
  updatedTools: string[];
}

// Upserts local marketplace entries (absolute path may change); never removes entries; skips non-local if already present.
export class MarketplaceSyncSettingsUseCase {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly manifestRepo: ManifestRepository,
    private readonly marketplaceRegistry: MarketplaceRegistry,
    private readonly catalogRepo: PluginCatalogRepository,
    private readonly hasher: Hasher
  ) {}

  async execute(options: MarketplaceSyncSettingsOptions): Promise<MarketplaceSyncSettingsResult> {
    const { projectRoot } = options;
    const [manifest, marketplaces] = await Promise.all([
      this.manifestRepo.load().catch(() => null),
      this.marketplaceRegistry.list(projectRoot),
    ]);
    if (manifest === null || marketplaces.length === 0) return { updatedTools: [] };
    const updatedTools: string[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      const updated = await this.syncTool(toolId, projectRoot, manifest, marketplaces);
      if (updated) updatedTools.push(toolId);
    }
    if (updatedTools.length > 0) await this.manifestRepo.save(manifest);
    return { updatedTools };
  }

  private async syncTool(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[]
  ): Promise<boolean> {
    const toolConfig = getToolConfig(toolId);
    if (toolConfig === undefined || !isAiTool(toolConfig)) return false;
    const caps = toolConfig.capabilities as {
      plugins?: { marketplaceSettings: MarketplaceSettings | null };
    };
    if (!("plugins" in caps) || caps.plugins?.marketplaceSettings == null) return false;
    return this.syncToolSettings(
      toolId,
      projectRoot,
      manifest,
      marketplaces,
      caps.plugins.marketplaceSettings
    );
  }

  private async syncToolSettings(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceSettings
  ): Promise<boolean> {
    const versionByName = await this.loadAllVersions(projectRoot, marketplaces);
    const marketplaceChanged = await this.syncMarketplacesFile(
      toolId,
      projectRoot,
      manifest,
      settings,
      marketplaces,
      versionByName
    );
    const pluginsChanged =
      settings.enabledPluginsKey != null
        ? await this.syncEnabledPluginsFile(
            toolId,
            projectRoot,
            manifest,
            marketplaces,
            settings,
            versionByName
          )
        : false;
    return marketplaceChanged || pluginsChanged;
  }

  private async syncMarketplacesFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceSettings,
    marketplaces: readonly Marketplace[],
    versionByName: Map<string, string | undefined>
  ): Promise<boolean> {
    const absPath = resolve(projectRoot, settings.settingsPath);
    const json = await this.loadSettings(absPath);
    if (!this.mergeMarketplaces(json, settings, marketplaces, versionByName, projectRoot))
      return false;
    const content = JSON.stringify(json, null, 2);
    await this.fs.writeFile(absPath, content);
    manifest.updateTrackedFileHash(toolId, settings.settingsPath, this.hasher.hash(content));
    return true;
  }

  private async syncEnabledPluginsFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    settings: MarketplaceSettings,
    versionByName: Map<string, string | undefined>
  ): Promise<boolean> {
    const pluginsPath =
      settings.enabledPluginsSettingsPath ?? resolve(projectRoot, settings.settingsPath);
    const json = await this.loadSettings(pluginsPath);
    if (!this.mergeEnabledPlugins(json, settings, toolId, manifest, marketplaces, versionByName))
      return false;
    const content = JSON.stringify(json, null, 2);
    await this.fs.writeFile(pluginsPath, content);
    if (settings.enabledPluginsSettingsPath == null) {
      manifest.updateTrackedFileHash(toolId, settings.settingsPath, this.hasher.hash(content));
    }
    return true;
  }

  private mergeMarketplaces(
    json: Record<string, unknown>,
    settings: MarketplaceSettings,
    marketplaces: readonly Marketplace[],
    versionByName: Map<string, string | undefined>,
    projectRoot: string
  ): boolean {
    const existing = this.existingRecord(json, settings.settingsKey);
    const toMerge: Record<string, Record<string, unknown>> = {};
    for (const m of marketplaces) {
      const source = this.resolveSourceForSettings(m.source, projectRoot);
      const entry = settings.toEntry({ name: m.name, source, version: versionByName.get(m.name) });
      if (entry === null || entry.key in toMerge) continue;
      if (
        entry.key in existing &&
        JSON.stringify(existing[entry.key]) === JSON.stringify(entry.value)
      ) {
        continue;
      }
      toMerge[entry.key] = entry.value;
    }
    if (Object.keys(toMerge).length === 0) return false;
    json[settings.settingsKey] = { ...existing, ...toMerge };
    return true;
  }

  private mergeEnabledPlugins(
    json: Record<string, unknown>,
    settings: MarketplaceSettings,
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly Marketplace[],
    versionByName: Map<string, string | undefined>
  ): boolean {
    const pluginsKey = settings.enabledPluginsKey;
    if (pluginsKey == null) return false;
    const existing = this.existingRecord(json, pluginsKey);
    const toAdd: Record<string, boolean> = {};
    const marketplaceByName = new Map(marketplaces.map((m) => [m.name, m]));
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.marketplace == null) continue;
      const marketplace = marketplaceByName.get(plugin.marketplace);
      if (marketplace == null) continue;
      const entry = settings.toEntry({
        name: marketplace.name,
        source: marketplace.source,
        version: versionByName.get(marketplace.name),
      });
      if (entry == null) continue;
      const key = `${plugin.name}@${entry.key}`;
      if (!(key in existing)) toAdd[key] = true;
    }
    if (Object.keys(toAdd).length === 0) return false;
    json[pluginsKey] = { ...existing, ...toAdd };
    return true;
  }

  private async loadAllVersions(
    projectRoot: string,
    marketplaces: readonly Marketplace[]
  ): Promise<Map<string, string | undefined>> {
    const entries = await Promise.all(
      marketplaces.map(async (m) => {
        const version = await this.loadCatalogVersion(projectRoot, m.name);
        return [m.name, version] as const;
      })
    );
    return new Map(entries);
  }

  private async loadCatalogVersion(
    projectRoot: string,
    marketplaceName: string
  ): Promise<string | undefined> {
    const cacheDir = marketplaceCacheDir(projectRoot, marketplaceName);
    const catalog = await this.catalogRepo.load(cacheDir).catch(() => null);
    return catalog?.version;
  }

  private existingRecord(
    json: Record<string, unknown>,
    settingsKey: string
  ): Record<string, unknown> {
    const raw = json[settingsKey];
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
  }

  private resolveSourceForSettings(source: PluginSource, projectRoot: string): PluginSource {
    if (source.kind !== "local") return source;
    return { kind: "local", path: resolve(projectRoot, source.path).replace(/\\/g, "/") };
  }

  private async loadSettings(absPath: string): Promise<Record<string, unknown>> {
    try {
      const content = await this.fs.readFile(absPath);
      const parsed = JSON.parse(content);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* file missing or unparseable — start fresh */
    }
    return {};
  }
}
