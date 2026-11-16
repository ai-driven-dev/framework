import { FRAMEWORK_MARKETPLACE_NAME } from "../../contexts/distribution/contract/marketplace.js";
import type { ActivateNativeTools } from "../../contexts/installation/application/sync/activate-native-tools.js";
import type { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.js";
import type { RecordActivation } from "../../contexts/installation/application/sync/record-activation.js";
import type { SyncToolSettingsFiles } from "../../contexts/installation/application/sync/sync-tool-settings-files.js";
import type { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.js";
import type { ToolCatalog } from "../../contexts/tools/contract/tool-catalog.js";
import type { MarketplaceScope } from "../../shared/domain/scope.js";
import type { ToolId } from "../../shared/domain/tool.js";

export interface SyncSettingsOptions {
  projectRoot: string;
  /** The profiles of the tools this run may ask, handed per call. */
  tools: ToolCatalog;
  /** Limits both the settings sync and the native activation to these tools; every
   * installed tool when absent. */
  toolIds?: readonly ToolId[];
  /** Re-registers the framework marketplace when this run finds none at all — `sync` alone
   * sets it, so every other caller reads an empty registry as found rather than repopulating it. */
  recreateFrameworkIfMissing?: boolean;
  /**
   * The scope this run enables plugins at, which is a different question than a marketplace's
   * own `scope`. `"user"` also writes nothing under `projectRoot`, so `syncTool` is skipped.
   */
  scope?: MarketplaceScope;
  /**
   * Narrows the settings sync and native activation to the marketplaces named here; absent
   * activates every registered one. A name matching nothing resolves to zero marketplaces,
   * never a fallback to every one.
   */
  marketplaceNames?: readonly string[];
  /**
   * Framework plugins a tool with native activation also enables at this run's scope, on top
   * of the ones its manifest records — what `setup --global --plugins` asks for, since a
   * machine-scope install records no plugin a host loads by itself.
   */
  enablePlugins?: readonly string[];
}

export interface SyncSettingsResult {
  /** Tools whose own CLI actually ran, whether or not every step inside it succeeded. */
  activated: readonly ToolId[];
  /** Tools with a native activation whose binary was not on PATH — nothing of theirs
   * ran, so the settings this pass wrote will not load until it has. */
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  /** What a recoverable, best-effort step logged — the same text `logger.warn` received. */
  warnings: readonly string[];
  /** A hard failure that is not the recoverable `NativePluginCliError` family: a bug in an
   * activator, or the source-conflict guard's deliberate refusal. Returned rather than thrown,
   * so whether the whole command fails stays the caller's decision. */
  errors: readonly { scope: string; message: string }[];
}

const EMPTY_RESULT: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
};

/** Brings a project's (or the machine's) tool settings and native registrations in line with its manifest. */
export class SyncSettings {
  constructor(
    private readonly loadContext: LoadSyncContext,
    private readonly settingsFiles: SyncToolSettingsFiles,
    private readonly activateNativeTools: ActivateNativeTools,
    private readonly recordActivation: RecordActivation,
    private readonly sharedSource: SharedFrameworkSource
  ) {}

  execute(options: SyncSettingsOptions): Promise<SyncSettingsResult> {
    return this.loadContext.runLocked(options.scope ?? "project", () =>
      this.executeLocked(options)
    );
  }

  private async executeLocked(options: SyncSettingsOptions): Promise<SyncSettingsResult> {
    const { projectRoot, tools } = options;
    const scope = options.scope ?? "project";
    const context = await this.loadContext.execute({
      projectRoot,
      toolIds: options.toolIds,
      recreateFrameworkIfMissing: options.recreateFrameworkIfMissing,
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
      scope,
      marketplaceNames: options.marketplaceNames,
    });
    if (context === null) return EMPTY_RESULT;
    const { manifest, marketplaces } = context;
    // A user-scope run lands nothing under `projectRoot`, so no project settings file mirrors it.
    if (
      scope === "project" &&
      (await this.settingsFiles.syncProjectTools(
        tools,
        projectRoot,
        manifest,
        marketplaces,
        context.toolIds
      ))
    )
      await context.save();
    const activation = await this.activateNativeTools.execute({
      tools,
      projectRoot,
      context,
      scope,
      enablePlugins: options.enablePlugins ?? [],
      frameworkMarketplaceName: FRAMEWORK_MARKETPLACE_NAME,
    });
    if (
      scope === "project" &&
      (await this.settingsFiles.syncProvenPlugins(
        tools,
        projectRoot,
        manifest,
        marketplaces,
        activation.outcomes
      ))
    )
      await context.save();
    // A refused or unproven host registration cannot establish a new shared-source claim.
    // User-scope runs have no project manifest for a later `clean` to decrement it.
    if (scope !== "user") {
      await this.sharedSource.recordSharedSourceReference(
        projectRoot,
        marketplaces,
        activation.outcomes,
        FRAMEWORK_MARKETPLACE_NAME
      );
    }
    const wroteHashes = await this.recordActivation.recordWhatActivationWrote(
      tools,
      projectRoot,
      manifest,
      [...activation.outcomes.keys()]
    );
    const wroteRegistrations = this.recordActivation.recordNativeRegistrations(
      tools,
      manifest,
      activation.outcomes,
      options.marketplaceNames !== undefined
    );
    if (wroteHashes || wroteRegistrations) await context.save();
    await this.recordActivation.recordMachinePluginClaims(
      tools,
      manifest,
      activation.outcomes,
      marketplaces,
      scope,
      scope === "project" ? projectRoot : undefined
    );
    if (options.recreateFrameworkIfMissing === true && scope === "project") {
      await this.sharedSource.purgeStaleProjectCache(
        projectRoot,
        marketplaces,
        activation,
        FRAMEWORK_MARKETPLACE_NAME
      );
    }
    return {
      activated: [...activation.outcomes.keys()],
      binaryMissing: activation.binaryMissing,
      warnings: activation.warnings,
      errors: activation.errors,
    };
  }
}
