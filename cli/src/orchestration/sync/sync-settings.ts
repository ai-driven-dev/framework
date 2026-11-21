import type { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.js";
import type { RecordActivation } from "../../contexts/installation/application/sync/record-activation.js";
import type { SyncToolSettingsFiles } from "../../contexts/installation/application/sync/sync-tool-settings-files.js";
import type { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { ToolId } from "../../shared/domain/tool.js";
import type { ActivateNativeTools } from "./activate-native-tools.js";
import { claimsViewOf } from "./claims-view-of.js";

export interface SyncSettingsOptions {
  projectRoot: string;
  /** Limits both the settings sync and the native activation to these tools; every
   * installed tool when absent. */
  toolIds?: readonly ToolId[];
  /** Re-registers the framework marketplace when this run finds none at all: `sync` alone
   * sets it, so every other caller reads an empty registry as found rather than repopulating it. */
  recreateFrameworkIfMissing?: boolean;
  /**
   * The scope this run enables plugins at, which is a different question than a marketplace's
   * own `scope`. `"user"` also writes nothing under `projectRoot`, so `syncTool` is skipped.
   */
  scope?: Scope;
  /**
   * Narrows the settings sync and native activation to the marketplaces named here; absent
   * activates every registered one. A name matching nothing resolves to zero marketplaces,
   * never a fallback to every one.
   */
  marketplaceNames?: readonly string[];
  /**
   * Framework plugins a tool with native activation also enables at this run's scope, on top
   * of the ones its manifest records: what `setup --global --plugins` asks for, since a
   * machine-scope install records no plugin a host loads by itself.
   */
  enablePlugins?: readonly string[];
}

export interface SyncSettingsResult {
  /** Tools whose own CLI actually ran, whether or not every step inside it succeeded. */
  activated: readonly ToolId[];
  /** Tools with a native activation whose binary was not on PATH: nothing of theirs
   * ran, so the settings this pass wrote will not load until it has. */
  binaryMissing: readonly { toolId: ToolId; binary: string }[];
  /** What a recoverable, best-effort step logged: the same text `logger.warn` received. */
  warnings: readonly string[];
  /** A hard failure that is not the recoverable `NativePluginCliError` family: a bug in an
   * activator, or the source-conflict guard's deliberate refusal. Returned rather than thrown,
   * so whether the whole command fails stays the caller's decision. */
  errors: readonly { scope: string; error: unknown }[];
  /** The verdict on `errors`: one returned error fails the run. Decided here, where the errors
   * are produced, so a command only prints it and exits on it. */
  failed: boolean;
}

const EMPTY_RESULT: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
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
    const { projectRoot } = options;
    const scope = options.scope ?? "project";
    const context = await this.loadContext.execute({
      projectRoot,
      toolIds: options.toolIds,
      recreateFrameworkIfMissing: options.recreateFrameworkIfMissing,
      scope,
      marketplaceNames: options.marketplaceNames,
    });
    if (context === null) return EMPTY_RESULT;
    const { manifest, marketplaces } = context;
    // A user-scope run lands nothing under `projectRoot`, so no project settings file mirrors it.
    if (
      scope === "project" &&
      (await this.settingsFiles.execute({
        kind: "project-tools",
        projectRoot,
        manifest,
        marketplaces,
        toolIds: context.toolIds,
      }))
    )
      await context.save();
    const activation = await this.activateNativeTools.execute({
      projectRoot,
      context,
      claims: (toolId) => claimsViewOf(context, toolId),
      scope,
      enablePlugins: options.enablePlugins ?? [],
    });
    if (
      scope === "project" &&
      (await this.settingsFiles.execute({
        kind: "proven-plugins",
        projectRoot,
        manifest,
        marketplaces,
        outcomes: activation.outcomes,
      }))
    )
      await context.save();
    await this.recordActivationOf({ options, scope, context, activation });
    return {
      activated: [...activation.outcomes.keys()],
      binaryMissing: activation.binaryMissing,
      warnings: activation.warnings,
      errors: activation.errors,
      failed: activation.errors.length > 0,
    };
  }

  private async recordActivationOf(run: {
    options: SyncSettingsOptions;
    scope: Scope;
    context: NonNullable<Awaited<ReturnType<LoadSyncContext["execute"]>>>;
    activation: Awaited<ReturnType<ActivateNativeTools["execute"]>>;
  }): Promise<void> {
    const { options, scope, context, activation } = run;
    const { projectRoot } = options;
    const { manifest, marketplaces } = context;
    // A refused or unproven host registration cannot establish a new shared-source claim.
    // User-scope runs have no project manifest for a later `clean` to decrement it.
    if (scope !== "user") {
      await this.sharedSource.execute({
        kind: "record-reference",
        projectRoot,
        marketplaces,
        outcomes: activation.outcomes,
      });
    }
    const wroteHashes = await this.recordActivation.execute({
      kind: "settings-written-by-host",
      projectRoot,
      manifest,
      activated: [...activation.outcomes.keys()],
    });
    const wroteRegistrations = await this.recordActivation.execute({
      kind: "native-registrations",
      manifest,
      activated: activation.outcomes,
      narrowed: options.marketplaceNames !== undefined,
    });
    if (wroteHashes || wroteRegistrations) await context.save();
    await this.recordActivation.execute({
      kind: "machine-claims",
      project: manifest,
      outcomes: activation.outcomes,
      marketplaces,
      scope,
      projectRoot: scope === "project" ? projectRoot : undefined,
    });
    if (options.recreateFrameworkIfMissing === true && scope === "project") {
      await this.sharedSource.execute({
        kind: "purge-stale-project-cache",
        projectRoot,
        marketplaces,
        activation,
      });
    }
  }
}
