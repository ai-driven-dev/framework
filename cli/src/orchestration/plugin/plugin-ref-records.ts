import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { RecordedPluginRef } from "../../contexts/installation/application/removal/project-plugin-withdrawal.js";
import type { ScopeRecords } from "../../contexts/installation/contract/records/scope-records.js";

/** A plugin's ref in its record, as the host registration reads and drops it: the ref sits under
 * the marketplace the plugin came from. The records are read and written through whoever keeps them. */
export function pluginRefRecords(
  records: Pick<RegistrationRecordRules, "refOf" | "withoutRef"> & ScopeRecords
): RecordedPluginRef {
  return {
    loadRecords: () => records.loadRecords(),
    saveRecords: (saved) => records.saveRecords(saved),
    recordedRef: (registrations, { plugin, marketplace }) =>
      records.refOf(registrations, plugin.name, marketplace),
    withoutRef: (registrations, ref) => records.withoutRef(registrations, ref),
  };
}
