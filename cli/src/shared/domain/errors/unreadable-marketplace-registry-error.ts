import { AiddError } from "./aidd-error.js";

/** An unreadable registry file is never read as an empty one: `save()` reads this same list,
 * appends to it and writes the whole file back, so a silent empty read would delete the
 * marketplaces a person registered on the very next write. */
export class UnreadableMarketplaceRegistryError extends AiddError {
  readonly code = "unreadable-marketplace-registry";
  constructor(path: string, reason: string) {
    super(
      `Cannot read the marketplace registry at ${path}: ${reason}. Repair the file, or ` +
        `delete it to start from an empty registry.`
    );
    this.name = "UnreadableMarketplaceRegistryError";
  }
}
