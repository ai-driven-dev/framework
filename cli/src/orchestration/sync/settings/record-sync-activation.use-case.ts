import type { RecordNativeRegistrations } from "../../../contexts/host-registration/application/register/record-native-registrations.use-case.js";
import type { LoadSyncContext } from "../../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { RecordActivation } from "../../../contexts/installation/application/sync/record-activation.use-case.js";
import type { SharedFrameworkSource } from "../../../contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import type { MachineClaimsRecording } from "../../../contexts/machine-claims/contract/machine-claims-recording.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { ActivateNativeTools } from "./activate-native-tools.use-case.js";
import type { SyncSettingsRequest } from "./sync-settings.js";

export type LoadedSyncContext = NonNullable<Awaited<ReturnType<LoadSyncContext["execute"]>>>;

export interface RecordSyncActivationRequest {
  options: SyncSettingsRequest;
  scope: Scope;
  context: LoadedSyncContext;
  activation: Awaited<ReturnType<ActivateNativeTools["execute"]>>;
}

export interface RecordSyncActivationDeps {
  readonly recordActivation: Pick<RecordActivation, "execute">;
  readonly machineClaims: MachineClaimsRecording;
  readonly sharedSource: Pick<SharedFrameworkSource, "execute">;
  readonly recordRegistrations: Pick<RecordNativeRegistrations, "execute">;
}

/** Writes down what a sync activated: the source this project references, the hashes and
 * registrations in its manifest, and what the machine now claims. */
export class RecordSyncActivation {
  constructor(private readonly deps: RecordSyncActivationDeps) {}

  async execute(run: RecordSyncActivationRequest): Promise<void> {
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
    const wroteRegistrations = this.deps.recordRegistrations.execute({
      records: context.records,
      activated: activation.outcomes,
      narrowed: options.marketplaceNames !== undefined,
    });
    if (wroteHashes || wroteRegistrations) await context.save();
    await this.recordMachineClaims(run);
  }

  private async recordMachineClaims(run: RecordSyncActivationRequest): Promise<void> {
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
