import type { CloneIdentity } from "../consent/clone-identity.js";
import type { CloneConsentReading, ConsentReading } from "../telemetry-consent.js";

/** A clone's own word on whether it is measured. */
export interface ConsentSource {
  /** `aidd.telemetry` in the repository's git config at `root`: shared by its linked
   * worktrees, committed nowhere. */
  read(root: string): Promise<ConsentReading>;
  /** The same key, read from the git config of `clone`, the clone as it was recorded: `gone`
   * unless the common git dir at its path is still that very directory. A working tree that is
   * gone is judged by the clone it belonged to, and a clone made at the same path since is not
   * that clone. */
  readClone(clone: CloneIdentity): Promise<CloneConsentReading>;
}
