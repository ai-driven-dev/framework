import type { UserSourceReferences } from "../ports/user-source-references.js";

/**
 * What a clean reads and releases on the machine record: the projects still referencing the
 * shared source, and this project's own claim on it. Absent ports report nothing rather than
 * guessing.
 */
export class ReleaseClaims {
  constructor(private readonly userSourceReferences?: UserSourceReferences) {}

  /** Every project on this machine that `references.json` still names, existing paths only. */
  async referencingProjects(): Promise<readonly string[]> {
    if (this.userSourceReferences === undefined) return [];
    return this.userSourceReferences.listAllReferencingProjects();
  }
}
