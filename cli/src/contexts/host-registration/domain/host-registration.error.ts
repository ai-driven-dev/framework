import { AiddError } from "../../../shared/domain/shared.error.js";

/** A host's own marketplace registry already holds this catalog's declared name pointed at a
 * genuinely *different* catalog, so registering it would steal or mislabel that name. A
 * project's local alias diverging from its catalog's declared name is not this, and is never
 * refused. */
export class MarketplaceSourceConflictError extends AiddError {
  readonly code = "marketplace-source-conflict";
  constructor(message: string) {
    super(message);
  }
}

export class NativePluginCliError extends AiddError {
  readonly code = "native-plugin-cli";
  constructor(message: string) {
    super(message);
  }
}

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
  }
}
