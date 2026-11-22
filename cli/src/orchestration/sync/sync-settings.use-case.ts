import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { LoadSyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { RecordActivation } from "../../contexts/installation/application/sync/record-activation.use-case.js";
import type { SharedFrameworkSource } from "../../contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import type { MachineClaimsRecording } from "../../contexts/machine-claims/contract/machine-claims-recording.js";
import type { RecordClaimRules } from "../../contexts/machine-claims/contract/record-claim-rules.js";
import type { Scope } from "../../shared/domain/scope.js";
import type { SyncSettingsRequest, SyncSettingsResult } from "../domain/sync-settings.model.js";
import type { ActivateNativeTools } from "./activate-native-tools.use-case.js";
import { claimsViewOf } from "./claims-view-of.js";
import type { SyncToolSettingsFiles } from "./sync-tool-settings-files.use-case.js";

const EMPTY_RESULT: SyncSettingsResult = {
  activated: [],
  binaryMissing: [],
  warnings: [],
  errors: [],
  failed: false,
};

type LoadedSyncContext = NonNullable<Awaited<ReturnType<LoadSyncContext["execute"]>>>;

interface ActivationRecording {
  options: SyncSettingsRequest;
  scope: Scope;
  context: LoadedSyncContext;
  activation: Awaited<ReturnType<ActivateNativeTools["execute"]>>;
}

export interface SyncSettingsDeps {
  readonly loadContext: LoadSyncContext;
  readonly settingsFiles: SyncToolSettingsFiles;
  readonly activateNativeTools: ActivateNativeTools;
  readonly recordActivation: RecordActivation;
  readonly machineClaims: MachineClaimsRecording;
  readonly sharedSource: SharedFrameworkSource;
  readonly records: Pick<RegistrationRecordRules, "afterActivation"> &
    Pick<RecordClaimRules, "claimedRefs">;
}

function resultOf(activation: ActivationRecording["activation"]): SyncSettingsResult {
  return {
    activated: [...activation.outcomes.keys()],
    binaryMissing: activation.binaryMissing,
    warnings: activation.warnings,
    errors: activation.errors,
    failed: activation.errors.length > 0,
  };
}

/** Brings a project's (or the machine's) tool settings and native registrations in line with its manifest. */
export class SyncSettings {
  constructor(private readonly deps: SyncSettingsDeps) {}

  execute(options: SyncSettingsRequest): Promise<SyncSettingsResult> {
    return this.deps.loadContext.runLocked(options.scope ?? "project", () =>
      this.executeLocked(options)
    );
  }

  private async executeLocked(options: SyncSettingsRequest): Promise<SyncSettingsResult> {
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
    await this.recordActivationOf({ options, scope, context, activation });
    return resultOf(activation);
  }

  private activate(run: Omit<ActivationRecording, "activation">) {
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

  private async recordActivationOf(run: ActivationRecording): Promise<void> {
    const { options, scope, context, activation } = run;
    const { projectRoot } = options;
    const { manifest, marketplaces } = context;
    // A refused or unproven host registration cannot establish a new shared-source claim.
    // User-scope runs have no project manifest for a later `clean` to decrement it.
    if (scope !== "user") {
      await this.deps.sharedSource.execute({
        kind: "record-reference",
        projectRoot,
        marketplaces,
        outcomes: activation.outcomes,
      });
    }
    const wroteHashes = await this.deps.recordActivation.execute({
      kind: "settings-written-by-host",
      projectRoot,
      manifest,
      activated: [...activation.outcomes.keys()],
    });
    const wroteRegistrations = await this.deps.recordActivation.execute({
      kind: "native-registrations",
      manifest,
      activated: activation.outcomes,
      narrowed: options.marketplaceNames !== undefined,
      afterActivation: this.deps.records.afterActivation,
    });
    if (wroteHashes || wroteRegistrations) await context.save();
    await this.recordMachineClaims(run);
  }

  private async recordMachineClaims(run: ActivationRecording): Promise<void> {
    const { options, scope, context, activation } = run;
    const { manifest, marketplaces } = context;
    await this.deps.machineClaims.execute({
      project: manifest,
      outcomes: activation.outcomes,
      marketplaces,
      scope,
      projectRoot: scope === "project" ? options.projectRoot : undefined,
    });
    if (options.recreateFrameworkIfMissing === true && scope === "project") {
      await this.deps.sharedSource.execute({
        kind: "purge-stale-project-cache",
        projectRoot: options.projectRoot,
        marketplaces,
        activation,
      });
    }
  }
}
