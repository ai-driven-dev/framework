import { machineOwnership } from "../../../../src/composition/contexts/machine-claims.js";
import { detachProjectClaims } from "../../../../src/contexts/machine-claims/application/removal/detach-project-claims.js";
import { removalClaims } from "../../../../src/contexts/machine-claims/application/removal/removal-claims.js";
import type { FileReader } from "../../../../src/shared/ports/file-reader.js";

type Repo = Parameters<typeof machineOwnership>[0];

/** The claims a plugin removal releases, over this machine manifest. */
export function removalClaimsOf(repo: Repo, fs: FileReader) {
  const { detachNativePluginRefs, detachUserPlugin } = machineOwnership(repo, fs);
  return removalClaims(detachNativePluginRefs, detachUserPlugin);
}

/** A project's claims released from this machine manifest, native refs first. */
export function detachProjectClaimsOf(repo: Repo, fs: FileReader) {
  const { detachNativePluginRefs, detachUserPlugin } = machineOwnership(repo, fs);
  return detachProjectClaims(detachNativePluginRefs, detachUserPlugin);
}
