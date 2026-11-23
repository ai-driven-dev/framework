import type { HostRegistrationOutcome } from "../../../contexts/host-registration/application/register/registration-outcome.js";
import type {
  MarketplaceRegistrationAnswers,
  NativeHostCatalog,
} from "../../../contexts/host-registration/contract/native-registration-spec.js";
import type { TrackedSharedSettings } from "../../../contexts/installation/application/sync/tracked-shared-settings.js";
import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { BuildMarketplaceForTool } from "./build-marketplace-for-tool.use-case.js";
import type { RefRules, SyncedManifest, SyncedMarketplaces } from "./plugin-refs-run.js";

interface SyncRun {
  readonly projectRoot: string;
  readonly manifest: SyncedManifest;
  readonly marketplaces: SyncedMarketplaces;
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

/** The new content of a parsed shared settings file, null when there is nothing to change. */
export interface SettingsDeclarationRules {
  readonly withoutMarketplaces: (
    shared: Record<string, unknown>,
    settingsKey: string
  ) => Record<string, unknown> | null;
  readonly withEnabledPlugins: (
    shared: Record<string, unknown>,
    enabledPluginsKey: string | null,
    refs: readonly string[]
  ) => Record<string, unknown> | null;
  readonly registersBySettingsFile: (settings: MarketplaceRegistrationAnswers) => boolean;
  readonly registersByProvenRefs: (settings: MarketplaceRegistrationAnswers) => boolean;
  readonly declaredRefs: (
    recorded: readonly { plugin: string; marketplace?: string | null }[],
    marketplaces: SyncedMarketplaces,
    entryKeyOf: (marketplace: SyncedMarketplaces[number]) => string | null
  ) => string[];
}

/** What SyncToolSettingsFiles is built from. */
export interface SyncToolSettingsFilesDeps {
  readonly tracked: TrackedSharedSettings;
  readonly buildMarketplace: BuildMarketplaceForTool;
  readonly declaration: SettingsDeclarationRules;
  readonly refs: RefRules;
}

/** The project settings files a tool shares with its host, kept in step with the manifest. */
export class SyncToolSettingsFiles {
  constructor(
    private readonly deps: SyncToolSettingsFilesDeps,
    private readonly tools: NativeHostCatalog
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
      const target = this.targetOf(toolId, this.deps.declaration.registersBySettingsFile);
      const updated = target !== null && (await this.syncToolSettings({ ...run, ...target }));
      anyToolUpdated = updated || anyToolUpdated;
    }
    return anyToolUpdated;
  }

  private async syncProvenPlugins(
    run: SyncRun & { readonly outcomes: ReadonlyMap<ToolId, HostRegistrationOutcome> }
  ): Promise<boolean> {
    let declarativeChanged = false;
    for (const [toolId, outcome] of run.outcomes) {
      const target = this.targetOf(toolId, this.deps.declaration.registersByProvenRefs);
      if (target === null) continue;
      const provenRefs = this.deps.refs.refsOnHosts(
        { pluginRefs: outcome.pluginRefs },
        [],
        outcome.marketplaces.map((entry) => entry.hostName)
      );
      if (provenRefs.length > 0 && (await this.enablePlugins({ ...run, ...target }, provenRefs)))
        declarativeChanged = true;
    }
    return declarativeChanged;
  }

  private targetOf(
    toolId: ToolId,
    wanted: (settings: MarketplaceRegistrationAnswers) => boolean
  ): { toolId: AiToolId; settings: MarketplaceRegistrationAnswers } | null {
    const profile = this.tools.aiProfileIfAny(toolId);
    const settings = profile?.marketplaceRegistration();
    if (profile == null || settings == null) return null;
    return wanted(settings) ? { toolId: profile.toolId, settings } : null;
  }

  private async syncToolSettings(target: ToolSettings): Promise<boolean> {
    const marketplaceChanged = await this.syncMarketplaces(target);
    const pluginsChanged = await this.enablePlugins(target);
    return marketplaceChanged || pluginsChanged;
  }

  // The marketplaces key names built trees by absolute path, so a profile may send it to a file
  // of its own. That file is written but never hashed: an absolute path recorded in the manifest
  // would read as drift on every other machine.
  private async syncMarketplaces(target: ToolSettings): Promise<boolean> {
    // Building the tree is this CLI's job whoever registers it: a tool that is not installed
    // today may be tomorrow, and the tree is what any registration points at.
    for (const m of target.marketplaces)
      await this.deps.buildMarketplace.execute(target.toolId, m, target.projectRoot);
    return this.evictMarketplaces(target);
  }

  // The key kept an absolute path in the shared, committed file, wrong for everyone but its
  // author. Take it out and re-hash, so the move reaches projects that already exist.
  private async evictMarketplaces(target: ToolSettings): Promise<boolean> {
    const without = this.deps.declaration.withoutMarketplaces(
      await this.read(target),
      target.settings.marketplacesKey()
    );
    if (without === null) return false;
    await this.write(target, without);
    return true;
  }

  private async enablePlugins(
    target: ToolSettings,
    provenRefs?: readonly string[]
  ): Promise<boolean> {
    const enabled = this.deps.declaration.withEnabledPlugins(
      await this.read(target),
      target.settings.enabledPluginsKey(),
      provenRefs ?? this.refsToEnable(target)
    );
    if (enabled === null) return false;
    await this.write(target, enabled);
    return true;
  }

  private refsToEnable(target: ToolSettings): readonly string[] {
    const { settings, toolId, manifest, marketplaces } = target;
    const recorded = manifest
      .getRecordedPlugins(toolId)
      .map((r) => ({ plugin: r.plugin.name, marketplace: r.marketplace }));
    return this.deps.declaration.declaredRefs(recorded, marketplaces, (m) =>
      settings.entryKeyFor(m)
    );
  }

  private read({ projectRoot, settings }: ToolSettings): Promise<Record<string, unknown>> {
    return this.deps.tracked.read(projectRoot, settings.sharedSettingsFile());
  }

  private write(
    { projectRoot, settings, manifest, toolId }: ToolSettings,
    json: Record<string, unknown>
  ): Promise<void> {
    const path = settings.sharedSettingsFile();
    return this.deps.tracked.write({ projectRoot, path, manifest, toolId }, json);
  }
}
