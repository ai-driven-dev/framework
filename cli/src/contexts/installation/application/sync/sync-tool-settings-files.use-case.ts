import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import { tryParseJson } from "../../../../shared/domain/reading/json-file.js";
import { asPlainObject } from "../../../../shared/domain/reading/plain-object.js";
import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import type { Manifest } from "../../domain/manifest.js";
import type { DeclaredMarketplace } from "../../ports/marketplace-sources.js";
import type { HostRegistrationOutcome, RegistrationRecordRules } from "../../ports/native-host.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.use-case.js";

interface SyncRun {
  readonly projectRoot: string;
  readonly manifest: Manifest;
  readonly marketplaces: readonly DeclaredMarketplace[];
}

/** One tool's shared settings file within a run. */
interface ToolSettings extends SyncRun {
  readonly toolId: AiToolId;
  readonly settings: MarketplaceRegistrationAnswers;
}

/** `project-tools`: every tool that registers by its own settings file, never one that needs the
 * host's proof. `proven-plugins`: only the refs the host itself proved, for a tool whose settings
 * file needs that proof. Each answers whether it changed the manifest. */
export type SyncToolSettingsFilesRequest =
  | (SyncRun & { readonly kind: "project-tools"; readonly toolIds: readonly ToolId[] })
  | (SyncRun & {
      readonly kind: "proven-plugins";
      readonly outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome>;
    });

/** What SyncToolSettingsFiles is built from. */
export interface SyncToolSettingsFilesDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  readonly buildMarketplace: BuildMarketplaceForTool;
  readonly records: RegistrationRecordRules;
}

/** The project settings files a tool shares with its host, kept in step with the manifest. */
export class SyncToolSettingsFiles {
  constructor(
    private readonly deps: SyncToolSettingsFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  execute(request: SyncToolSettingsFilesRequest): Promise<boolean> {
    return request.kind === "project-tools"
      ? this.syncProjectTools(request)
      : this.syncProvenPlugins(request);
  }

  private async syncProjectTools(
    run: SyncRun & { readonly toolIds: readonly ToolId[] }
  ): Promise<boolean> {
    let anyToolUpdated = false;
    for (const toolId of run.toolIds) {
      const profile = this.tools.aiProfileIfAny(toolId);
      const settings = profile?.marketplaceRegistration();
      if (profile == null || settings == null || settings.requiresNativeProof()) continue;
      if (await this.syncToolSettings({ ...run, toolId: profile.toolId, settings }))
        anyToolUpdated = true;
    }
    return anyToolUpdated;
  }

  private async syncProvenPlugins(
    run: SyncRun & { readonly outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome> }
  ): Promise<boolean> {
    let declarativeChanged = false;
    for (const [toolId, outcome] of run.outcomes) {
      const profile = this.tools.aiProfileIfAny(toolId);
      const settings = profile?.marketplaceRegistration();
      if (profile == null || settings?.requiresNativeProof() !== true) continue;
      const provenRefs = this.deps.records.refsOnHosts(
        outcome,
        outcome.marketplaces.map((entry) => entry.hostName)
      );
      if (
        provenRefs.length > 0 &&
        (await this.syncEnabledPluginsFile(
          { ...run, toolId: profile.toolId, settings },
          provenRefs
        ))
      )
        declarativeChanged = true;
    }
    return declarativeChanged;
  }

  private async syncToolSettings(target: ToolSettings): Promise<boolean> {
    const marketplaceChanged = await this.syncMarketplacesFile(target);
    const pluginsChanged = await this.syncEnabledPluginsFile(target);
    return marketplaceChanged || pluginsChanged;
  }

  // The marketplaces key names built trees by absolute path, so a profile may send it to a file
  // of its own. That file is written but never hashed: an absolute path recorded in the manifest
  // would read as drift on every other machine.
  private async syncMarketplacesFile(target: ToolSettings): Promise<boolean> {
    // Building the tree is this CLI's job whoever registers it: a tool that is not installed
    // today may be tomorrow, and the tree is what any registration points at.
    for (const m of target.marketplaces)
      await this.deps.buildMarketplace.execute(target.toolId, m, target.projectRoot);
    return this.evictMarketplacesFromSharedFile(target);
  }

  // The key kept an absolute path in the shared, committed file, wrong for everyone but its
  // author. Take it out and re-hash, so the move reaches projects that already exist.
  private async evictMarketplacesFromSharedFile(target: ToolSettings): Promise<boolean> {
    const shared = await this.load(target);
    const without = target.settings.withoutMarketplaces(shared);
    if (without === null) return false;
    await this.write(target, without);
    return true;
  }

  private async syncEnabledPluginsFile(
    target: ToolSettings,
    provenRefs?: readonly string[]
  ): Promise<boolean> {
    const json = await this.load(target);
    const enabled = target.settings.withEnabledPlugins(json, this.refsToEnable(target, provenRefs));
    if (enabled === null) return false;
    await this.write(target, enabled);
    return true;
  }

  private refsToEnable(
    { settings, toolId, manifest, marketplaces }: ToolSettings,
    provenRefs?: readonly string[]
  ): readonly string[] {
    if (provenRefs !== undefined) return provenRefs;
    const refs: string[] = [];
    const marketplaceByName = new Map(marketplaces.map((m) => [m.name, m]));
    for (const recorded of manifest.getRecordedPlugins(toolId)) {
      if (recorded.marketplace == null) continue;
      const marketplace = marketplaceByName.get(recorded.marketplace);
      if (marketplace == null) continue;
      const entryKey = settings.entryKeyFor({
        name: marketplace.name,
        source: marketplace.source,
      });
      if (entryKey == null) continue;
      refs.push(this.deps.records.refOnHostName(recorded.plugin.name, entryKey));
    }
    return refs;
  }

  // These files are co-owned and the machine-local one is untracked and gitignored, which is
  // exactly the kind of file people hand-edit: a trailing comma must not take the whole sync
  // down with it.
  private async load({ projectRoot, settings }: ToolSettings): Promise<Record<string, unknown>> {
    const absPath = resolve(projectRoot, settings.sharedSettingsFile());
    if (!(await this.deps.fs.fileExists(absPath))) return {};
    const parsed = tryParseJson(await this.deps.fs.readFile(absPath));
    if (!parsed.ok) {
      this.deps.logger.warn(
        `Ignoring malformed JSON in ${absPath}; rewriting the keys this CLI owns.`
      );
      return {};
    }
    return asPlainObject(parsed.value) ?? {};
  }

  private async write(
    { projectRoot, settings, manifest, toolId }: ToolSettings,
    json: Record<string, unknown>
  ): Promise<void> {
    const content = JSON.stringify(json, null, 2);
    await this.deps.fs.writeFile(resolve(projectRoot, settings.sharedSettingsFile()), content);
    manifest.recordFileHash(toolId, settings.sharedSettingsFile(), FileHash.of(content));
  }
}
