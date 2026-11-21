import { AiddError } from "./aidd-error.js";

/** A host-facing registration must be keyed by the catalog's own declared name, and an
 * unreadable catalog leaves this CLI no other fact to key it by. Registering nothing beats
 * writing this project's local alias: a manifest that guessed would claim a `hostName` the
 * host was never asked to hold. */
export class UnreadableBuiltCatalogError extends AiddError {
  readonly code = "unreadable-built-catalog";
  constructor(path: string) {
    super(
      `Cannot read the marketplace catalog this project just built, at ${path} — nothing was ` +
        "registered for it. Run `aidd sync` again once the source is fixed."
    );
    this.name = "UnreadableBuiltCatalogError";
  }
}
