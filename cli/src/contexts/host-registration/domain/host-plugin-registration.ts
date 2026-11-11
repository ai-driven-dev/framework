import type { AiToolId } from "../../../kernel/tool.js";
import type { HostPluginRegistryReading } from "../contract/host-plugin-registry.js";
import {
  answeredRegistry,
  type HostRegistration,
  type HostRegistrationAnswer,
  type HostRegistrationEntry,
  type HostRegistrationEvidence,
} from "../contract/host-registration-answers.js";

export function buildHostRegistration(
  evidence: readonly HostRegistrationEvidence[]
): HostRegistration {
  const entries: HostRegistrationEntry[] = [];
  for (const item of evidence) {
    const { tool, plugins, reading } = item;
    for (const plugin of plugins) {
      entries.push(hostRegistrationEntry(tool, plugin, reading, item.declaresNativeActivation));
    }
  }
  return { entries };
}

function hostRegistrationEntry(
  tool: AiToolId,
  plugin: { readonly name: string; readonly marketplace?: string },
  reading: HostPluginRegistryReading | undefined,
  declaresNativeActivation: boolean | undefined
): HostRegistrationEntry {
  // No marketplace recorded means no ref exists to look up — every measured host keys its
  // registry on `<plugin>@<marketplace>`, so this is unanswerable at the source rather than
  // a lookup that failed.
  if (plugin.marketplace === undefined || plugin.marketplace === "") {
    return {
      tool,
      plugin: plugin.name,
      answer: "unanswerable",
      detail: "AIDD records no marketplace for it, so no host registry can be asked",
    };
  }
  const ref = `${plugin.name}@${plugin.marketplace}`;
  return {
    tool,
    plugin: plugin.name,
    ref,
    ...answerForRef(tool, ref, reading, declaresNativeActivation),
  };
}

/** What one registry says about one ref, given the reading it produced. Split from the
 * entry it becomes so the two absences above — no ref to ask about, and no registry to ask
 * — stay visibly separate from the four answers a registry can give. */
function answerForRef(
  tool: AiToolId,
  ref: string,
  reading: HostPluginRegistryReading | undefined,
  declaresNativeActivation: boolean | undefined
): { answer: HostRegistrationAnswer; detail: string } {
  const answered = answeredRegistry(tool, reading, declaresNativeActivation);
  if ("detail" in answered) return answered;
  const entry = answered.refs.get(ref);
  if (entry === undefined) {
    return {
      answer: "not-registered",
      detail: `${answered.location} does not carry ${ref} — ${tool} will drop the declaration as orphaned`,
    };
  }
  if (!entry.enabled) {
    return {
      answer: "registered-disabled",
      detail: `${answered.location} carries ${ref} and records it disabled`,
    };
  }
  return { answer: "registered", detail: answered.location };
}
