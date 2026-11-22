import type { LoadSyncContext } from "../../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { RecordClaimRules } from "../../../contexts/machine-claims/contract/record-claim-rules.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { SyncSettingsRequest, SyncSettingsResult } from "../../domain/sync-settings.model.js";
import type { ActivateNativeTools } from "./activate-native-tools.use-case.js";
import { claimsViewOf } from "./claims-view-of.js";
import type {
  LoadedSyncContext,
  RecordSyncActivation,
  RecordSyncActivationRequest,
} from "./record-sync-activation.use-case.js";
import type { SyncToolSettingsFiles } from "./sync-tool-settings-files.use-case.js";

const EMPTY_RESULT: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
};

export interface RunSettingsSyncDeps {
  readonly loadContext: LoadSyncContext;
  readonly settingsFiles: SyncToolSettingsFiles;
  readonly activateNativeTools: ActivateNativeTools;
  readonly recordActivation: RecordSyncActivation;
  readonly records: Pick<RecordClaimRules, "claimedRefs">;
}

function resultOf(activation: RecordSyncActivationRequest["activation"]): SyncSettingsResult {
  return {
    activated: [...activation.outcomes.keys()],
    binaryMissing: activation.binaryMissing,
    warnings: activation.warnings,
    errors: activation.errors,
    failed: activation.errors.length > 0,
  };
}

/** One settings sync, run under whatever lock the caller holds. */
export class RunSettingsSync {
  constructor(private readonly deps: RunSettingsSyncDeps) {}

  async execute(options: SyncSettingsRequest): Promise<SyncSettingsResult> {
    const { projectRoot } = options;
    const scope = options.scope ?? "project";
    const context = await this.deps.loadContext.execute({
      projectRoot,
      toolIds: options.toolIds,
      recreateFrameworkIfMissing: options.recreateFrameworkIfMissing,
      scope,
      marketplaceNames: options.marketplaceNames,
    });
    if (context === null) return EMPTY_RESULT;
    const { manifest, marketplaces } = context;
    // A user-scope run lands nothing under `projectRoot`, so no project settings file mirrors it.
    await this.saveWhenProjectMirrored(scope, context, () =>
      this.deps.settingsFiles.execute({
        kind: "project-tools",
        projectRoot,
        manifest,
        marketplaces,
        toolIds: context.toolIds,
      })
    );
    const activation = await this.activate({ options, scope, context });
    await this.saveWhenProjectMirrored(scope, context, () =>
      this.deps.settingsFiles.execute({
        kind: "proven-plugins",
        projectRoot,
        manifest,
        marketplaces,
        outcomes: activation.outcomes,
      })
    );
    await this.deps.recordActivation.execute({ options, scope, context, activation });
    return resultOf(activation);
  }

  private activate(run: Omit<RecordSyncActivationRequest, "activation">) {
    const { options, scope, context } = run;
    return this.deps.activateNativeTools.execute({
      projectRoot: options.projectRoot,
      context,
      claims: (toolId) => claimsViewOf(context, toolId, this.deps.records),
      scope,
      enablePlugins: options.enablePlugins ?? [],
    });
  }

  private async saveWhenProjectMirrored(
    scope: Scope,
    context: LoadedSyncContext,
    mirror: () => Promise<boolean>
  ): Promise<void> {
    if (scope === "project" && (await mirror())) await context.save();
  }
}
