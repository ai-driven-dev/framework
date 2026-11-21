import type { ClaimsView } from "../../contexts/host-registration/contract/claims-view.js";
import type { SyncContext } from "../../contexts/installation/application/sync/load-sync-context.use-case.js";
import type { ToolId } from "../../shared/domain/tool.js";

/** What a sync run knows about the records, before any host registration asks for them. */
export type RecordFacts = Pick<
  SyncContext,
  "manifest" | "machineManifest" | "machineKept" | "persistedProject"
>;

/** What a host registration is checked against for one tool: the manifest's own record, the
 * machine's, and the one persisted for this project. */
export function claimsViewOf(facts: RecordFacts, toolId: ToolId): ClaimsView {
  return {
    recorded: facts.manifest.getNativeRegistrations(toolId),
    machine: async () => (await facts.machineManifest())?.getNativeRegistrations(toolId),
    machineKept: facts.machineKept,
    persistedProject: async () => (await facts.persistedProject())?.getNativeRegistrations(toolId),
  };
}
