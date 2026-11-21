import { AiddError } from "./aidd-error.js";

/** As `UnreadableMarketplaceRegistryError`: `references.json` is written by appending to
 * what it already holds, so a silent empty read on a corrupted file would delete every
 * other project's own reference on the very next write. */
export class UnreadableUserSourceReferencesError extends AiddError {
  readonly code = "unreadable-user-source-references";
  constructor(path: string, reason: string) {
    super(
      `Cannot read the shared-source reference registry at ${path}: ${reason}. Repair the ` +
        `file, or delete it to start from an empty registry.`
    );
    this.name = "UnreadableUserSourceReferencesError";
  }
}
