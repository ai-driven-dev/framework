import type { UserSourceReferences } from "../../../../src/contexts/machine-claims/ports/user-source-references.js";

/** A references port that remembers what it was asked and lists the projects it was given. */
export class RecordingSourceReferences implements UserSourceReferences {
  readonly added: { version: string; projectRoot: string }[] = [];
  readonly removed: (string | undefined)[] = [];

  constructor(private readonly listed: readonly string[] = []) {}

  async addReference(version: string, projectRoot: string): Promise<void> {
    this.added.push({ version, projectRoot });
  }

  async removeReference(projectRoot: string): Promise<void> {
    this.removed.push(projectRoot);
  }

  async listAllReferencingProjects(): Promise<readonly string[]> {
    return this.listed;
  }
}
