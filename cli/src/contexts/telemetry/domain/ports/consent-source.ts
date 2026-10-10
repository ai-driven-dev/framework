import type { ConsentReading } from "../telemetry-consent.js";

/** A clone's own word on whether it is measured. */
export interface ConsentSource {
  /** `aidd.telemetry` in the repository's git config at `root`: shared by its linked
   * worktrees, committed nowhere. */
  read(root: string): Promise<ConsentReading>;
}
