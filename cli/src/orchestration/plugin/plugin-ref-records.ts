import type { RegistrationRecordRules } from "../../contexts/host-registration/contract/registration-record-rules.js";
import type { RecordedPluginRef } from "../../contexts/installation/application/removal/project-plugin-withdrawal.js";

/** A plugin's ref in its record, as the host registration reads and drops it: the ref sits under
 * the marketplace the plugin came from. */
export function pluginRefRecords(
  records: Pick<RegistrationRecordRules, "refOf" | "withoutRef">
): RecordedPluginRef {
  return {
    recordedRef: (registrations, { name, marketplace }) =>
      records.refOf(registrations, name, marketplace),
    withoutRef: (registrations, ref) => records.withoutRef(registrations, ref),
  };
}
