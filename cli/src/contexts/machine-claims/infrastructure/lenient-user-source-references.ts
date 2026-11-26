import { UnreadableUserSourceReferencesError } from "../../../shared/domain/shared.error.js";
import type { Logger } from "../../../shared/ports/logger.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";

/**
 * The references a command it does not gate may read and write: a `references.json` this CLI
 * cannot make sense of is warned about and read as absent, so it never blocks that command. A
 * caller that must refuse on it, such as `clean --scope user`, uses the wrapped references
 * directly. Anything other than `UnreadableUserSourceReferencesError` is a bug, not a corrupted
 * file, and propagates.
 */
export class LenientUserSourceReferences implements UserSourceReferences {
  constructor(
    private readonly references: UserSourceReferences,
    private readonly logger: Logger
  ) {}

  addReference(version: string, projectRoot: string): Promise<void> {
    return this.tolerating(undefined, () => this.references.addReference(version, projectRoot));
  }

  removeReference(projectRoot: string): Promise<void> {
    return this.tolerating(undefined, () => this.references.removeReference(projectRoot));
  }

  listAllReferencingProjects(): Promise<readonly string[]> {
    return this.tolerating([], () => this.references.listAllReferencingProjects());
  }

  private async tolerating<T>(fallback: T, action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof UnreadableUserSourceReferencesError)) throw error;
      this.logger.warn("", error);
      return fallback;
    }
  }
}
