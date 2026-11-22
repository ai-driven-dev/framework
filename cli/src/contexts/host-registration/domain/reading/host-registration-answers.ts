import type { AiToolId } from "../../../../shared/domain/tool.js";
import type {
  HostPluginRegistryEntry,
  HostPluginRegistryReading,
} from "./plugin-registry-reading.js";

/** Whether a host's registry records one ref, and when it could not say, `unanswerable`. */
export type RegistrationAnswer =
  | "registered"
  | "registered-disabled"
  | "not-registered"
  | "unanswerable";

/** What `answeredRegistry` hands over: the refs a registry produced, or why nothing did. */
export type RegistryAnswer = ReturnType<typeof answeredRegistry>;

/** What the registry answers about `ref`. */
export function registrationAnswer(answered: RegistryAnswer, ref: string): RegistrationAnswer {
  if (!("refs" in answered)) return "unanswerable";
  const entry = answered.refs.get(ref);
  if (entry === undefined) return "not-registered";
  return entry.enabled ? "registered" : "registered-disabled";
}

/**
 * Either the refs a registry actually produced, or the reason nothing did: one value, so no
 * branch can reach a lookup against a registry that never opened.
 *
 * Three reasons, not one, because they send a person somewhere different: a tool that drives its
 * own CLI keeps a registry somebody could go and measure, a tool that declares no native
 * activation has none to look for, and a registry found but unreadable names the file and the
 * failure.
 */
export function answeredRegistry(
  tool: AiToolId,
  reading: HostPluginRegistryReading | undefined,
  declaresNativeActivation: boolean | undefined
):
  | { readonly refs: ReadonlyMap<string, HostPluginRegistryEntry>; readonly location: string }
  | { readonly answer: "unanswerable"; readonly detail: string } {
  if (reading === undefined) {
    return {
      answer: "unanswerable",
      detail:
        declaresNativeActivation === true
          ? `${tool} keeps a plugin registry, and nothing here has established its shape`
          : `${tool} declares no plugin registry to read`,
    };
  }
  if (reading.refs === undefined) {
    return {
      answer: "unanswerable",
      detail: `${reading.location} could not be read — ${reading.absent ? "ENOENT" : (reading.unreadable ?? "no reason given")}`,
    };
  }
  return { refs: reading.refs, location: reading.location };
}
