import { AiddError } from "./aidd-error.js";

/** A host's own marketplace registry already holds this catalog's declared name pointed at a
 * genuinely *different* catalog, so registering it would steal or mislabel that name. A
 * project's local alias diverging from its catalog's declared name is not this, and is never
 * refused. */
export class MarketplaceSourceConflictError extends AiddError {
  readonly code = "marketplace-source-conflict";
  constructor(message: string) {
    super(message);
    this.name = "MarketplaceSourceConflictError";
  }
}
