import type { CloneConsentReading, ConsentReading } from "../telemetry-consent.js";

/** A clone's own word on whether it is measured. */
export interface ConsentSource {
  /** `aidd.telemetry` in the repository's git config at `root`: shared by its linked
   * worktrees, committed nowhere. */
  read(root: string): Promise<ConsentReading>;
  /** The same key, read from the clone's own git config at `clone` (its common git dir), so a
   * working tree that is gone is judged by the clone it belonged to. */
  readClone(clone: string): Promise<CloneConsentReading>;
}
