import type {
  ClaimsView,
  RegistrationRecordView,
} from "../../../contexts/host-registration/contract/claims-view.js";
import type { RecordClaimRules } from "../../../contexts/machine-claims/contract/record-claim-rules.js";
import type { ToolId } from "../../../shared/domain/tool.js";

/** One scope's records, read when a host registration asks for them. */
type RecordsRead = () => Promise<ReadonlyMap<ToolId, RegistrationRecordView>>;

/** Where the claims a host registration is checked against are read from. Composition fills it
 * from machine claims, so a sync run never carries them. */
export interface ClaimsSource extends Pick<RecordClaimRules, "claimedRefs"> {
  /** The machine-wide records, absent when none are kept. */
  readonly machine: RecordsRead | undefined;
  /** The project's records as last saved, not the ones this run is changing. */
  readonly persistedProject: RecordsRead;
}

/** What a host registration is checked against for one tool: this run's own record, the
 * machine's, and the one persisted for this project. */
export function claimsViewOf(
  recorded: ReadonlyMap<ToolId, RegistrationRecordView>,
  toolId: ToolId,
  source: ClaimsSource
): ClaimsView {
  const { machine } = source;
  return {
    recorded: recorded.get(toolId),
    machine: async () => {
      const registrations = machine === undefined ? undefined : (await machine()).get(toolId);
      return registrations === undefined
        ? undefined
        : { ...registrations, claimedRefs: source.claimedRefs(registrations) };
    },
    machineKept: machine !== undefined,
    persistedProject: async () => (await source.persistedProject()).get(toolId),
  };
}
