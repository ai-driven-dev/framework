import type { NativeActivation } from "../contexts/tools/domain/native-registration/native-activation.js";
import type { BuiltToolConfig } from "../contexts/tools/domain/profile/define-tool.js";
import { DuplicateToolIdError } from "../shared/domain/errors.js";
import type { ToolId } from "../shared/domain/tool.js";

/** The native activation each given profile declares, by tool id. A profile that declares none
 * has no entry, and a tool registered twice is refused rather than resolved to its first copy. */
export function nativeRegistrationsOf(
  profiles: readonly BuiltToolConfig[]
): ReadonlyMap<ToolId, NativeActivation> {
  const seen = new Set<ToolId>();
  const registrations = new Map<ToolId, NativeActivation>();
  for (const profile of profiles) {
    if (seen.has(profile.toolId)) throw new DuplicateToolIdError(profile.toolId);
    seen.add(profile.toolId);
    const activation = profile.kind === "ai" ? profile.nativeActivation() : undefined;
    if (activation !== undefined) registrations.set(profile.toolId, activation);
  }
  return registrations;
}
