import { CatalogFetchAuthError } from "../../../src/shared/domain/shared.error.js";
import type { ReleaseLister } from "../../../src/shared/ports/release-lister.js";

export interface HeldReleases {
  /** Release tags in the order the forge lists them. */
  readonly tags: readonly string[];
  /** The notes by tag; a tag held without an entry has no notes. */
  readonly notes: Readonly<Record<string, string>>;
}

/** A forge held in memory: repositories with their releases, and the ones that need credentials. */
export class InMemoryReleaseLister implements ReleaseLister {
  constructor(
    private readonly repositories: Readonly<Record<string, HeldReleases>>,
    private readonly needCredentials: readonly string[] = []
  ) {}

  async listReleaseTags(repo: string): Promise<string[]> {
    this.refuseWhenPrivate(repo);
    return [...(this.repositories[repo]?.tags ?? [])];
  }

  async readReleaseBody(repo: string, tag: string): Promise<string | null> {
    this.refuseWhenPrivate(repo);
    return this.repositories[repo]?.notes[tag] ?? null;
  }

  private refuseWhenPrivate(repo: string): void {
    if (this.needCredentials.includes(repo)) throw new CatalogFetchAuthError(repo);
  }
}
