import { resolve } from "node:path";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Hasher } from "../../../../shared/ports/hasher.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { HostRegistrationOutcome, RegistrationRecordRules } from "../../ports/native-host.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.js";

/** The project settings files a tool shares with its host, kept in step with the manifest. */
export class SyncToolSettingsFiles {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly hasher: Hasher,
    private readonly logger: Logger,
    private readonly buildMarketplace: BuildMarketplaceForTool,
    private readonly records: RegistrationRecordRules
  ) {}

  /** Every tool that registers by its own settings file, never one that needs the host's proof. */
  async syncProjectTools(
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    toolIds: readonly ToolId[]
  ): Promise<boolean> {
    let anyToolUpdated = false;
    for (const toolId of toolIds) {
      if (tools.aiProfileIfAny(toolId)?.marketplaceRegistration()?.requiresNativeProof()) continue;
      if (await this.syncTool(tools, toolId, projectRoot, manifest, marketplaces))
        anyToolUpdated = true;
    }
    return anyToolUpdated;
  }

  /** Only the refs the host itself proved, for a tool whose settings file needs that proof. */
  async syncProvenPlugins(
    tools: ToolCatalog,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>
  ): Promise<boolean> {
    let declarativeChanged = false;
    for (const [toolId, outcome] of outcomes) {
      const settings = tools.aiProfileIfAny(toolId)?.marketplaceRegistration();
      if (settings?.requiresNativeProof() !== true) continue;
      const provenRefs = this.records.refsOnHosts(
        outcome,
        outcome.marketplaces.map((entry) => entry.hostName)
      );
      if (
        provenRefs.length > 0 &&
        (await this.syncEnabledPluginsFile(
          toolId,
          projectRoot,
          manifest,
          marketplaces,
          settings,
          provenRefs
        ))
      )
        declarativeChanged = true;
    }
    return declarativeChanged;
  }

  private async syncTool(
    tools: ToolCatalog,
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[]
  ): Promise<boolean> {
    const profile = tools.aiProfileIfAny(toolId);
    const marketplaceSettings = profile?.marketplaceRegistration();
    if (profile == null || marketplaceSettings == null) return false;
    return this.syncToolSettings(
      profile.toolId,
      projectRoot,
      manifest,
      marketplaces,
      marketplaceSettings
    );
  }

  private async syncToolSettings(
    toolId: AiToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    settings: MarketplaceRegistrationAnswers
  ): Promise<boolean> {
    const marketplaceChanged = await this.syncMarketplacesFile(
      toolId,
      projectRoot,
      manifest,
      settings,
      marketplaces
    );
    const pluginsChanged = await this.syncEnabledPluginsFile(
      toolId,
      projectRoot,
      manifest,
      marketplaces,
      settings
    );
    return marketplaceChanged || pluginsChanged;
  }

  // The marketplaces key names built trees by absolute path, so a profile may send it to a file
  // of its own. That file is written but never hashed: an absolute path recorded in the manifest
  // would read as drift on every other machine.
  private async syncMarketplacesFile(
    toolId: AiToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceRegistrationAnswers,
    marketplaces: readonly DeclaredMarketplace[]
  ): Promise<boolean> {
    // Building the tree is this CLI's job whoever registers it: a tool that is not installed
    // today may be tomorrow, and the tree is what any registration points at.
    for (const m of marketplaces) await this.buildMarketplace.execute(toolId, m, projectRoot);
    return this.evictMarketplacesFromSharedFile(toolId, projectRoot, manifest, settings);
  }

  // The key kept an absolute path in the shared, committed file, wrong for everyone but its
  // author. Take it out and re-hash, so the move reaches projects that already exist.
  private async evictMarketplacesFromSharedFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    settings: MarketplaceRegistrationAnswers
  ): Promise<boolean> {
    const sharedPath = resolve(projectRoot, settings.sharedSettingsFile());
    const shared = await this.loadSettings(sharedPath);
    const without = settings.withoutMarketplaces(shared);
    if (without === null) return false;
    const content = JSON.stringify(without, null, 2);
    await this.fs.writeFile(sharedPath, content);
    manifest.updateTrackedFileHash(
      toolId,
      settings.sharedSettingsFile(),
      this.hasher.hash(content)
    );
    return true;
  }

  private async syncEnabledPluginsFile(
    toolId: ToolId,
    projectRoot: string,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    settings: MarketplaceRegistrationAnswers,
    provenRefs?: readonly string[]
  ): Promise<boolean> {
    const pluginsPath = resolve(projectRoot, settings.sharedSettingsFile());
    const json = await this.loadSettings(pluginsPath);
    const enabled = settings.withEnabledPlugins(
      json,
      this.refsToEnable(settings, toolId, manifest, marketplaces, provenRefs)
    );
    if (enabled === null) return false;
    const content = JSON.stringify(enabled, null, 2);
    await this.fs.writeFile(pluginsPath, content);
    manifest.updateTrackedFileHash(
      toolId,
      settings.sharedSettingsFile(),
      this.hasher.hash(content)
    );
    return true;
  }

  private refsToEnable(
    settings: MarketplaceRegistrationAnswers,
    toolId: ToolId,
    manifest: Manifest,
    marketplaces: readonly DeclaredMarketplace[],
    provenRefs?: readonly string[]
  ): readonly string[] {
    if (provenRefs !== undefined) return provenRefs;
    const refs: string[] = [];
    const marketplaceByName = new Map(marketplaces.map((m) => [m.name, m]));
    for (const plugin of manifest.getPlugins(toolId)) {
      if (plugin.marketplace == null) continue;
      const marketplace = marketplaceByName.get(plugin.marketplace);
      if (marketplace == null) continue;
      const entryKey = settings.entryKeyFor({
        name: marketplace.name,
        source: marketplace.source,
      });
      if (entryKey == null) continue;
      refs.push(`${plugin.name}@${entryKey}`);
    }
    return refs;
  }

  // These files are co-owned and the machine-local one is untracked and gitignored, which is
  // exactly the kind of file people hand-edit: a trailing comma must not take the whole sync
  // down with it.
  private async loadSettings(absPath: string): Promise<Record<string, unknown>> {
    if (!(await this.fs.fileExists(absPath))) return {};
    const content = await this.fs.readFile(absPath);
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      this.logger.warn(`Ignoring malformed JSON in ${absPath}; rewriting the keys this CLI owns.`);
      return {};
    }
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  }
}
