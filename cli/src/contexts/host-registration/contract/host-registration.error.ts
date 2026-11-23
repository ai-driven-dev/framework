import { AiddError } from "../../../shared/domain/shared.error.js";

/** A host's own marketplace registry already holds this catalog's declared name pointed at a
 * genuinely *different* catalog, so registering it would steal or mislabel that name. A
 * project's local alias diverging from its catalog's declared name is not this, and is never
 * refused. */
export class MarketplaceSourceConflictError extends AiddError {
  readonly code = "marketplace-source-conflict";
  constructor(readonly detail: string) {
    super();
  }
}

/** A profile's native-registration section contradicts itself; refused when the profile loads. */
export class NativeRegistrationConfigError extends AiddError {
  readonly code = "native-registration-config";
  constructor(readonly detail: string) {
    super();
  }
}

export class NativePluginCliError extends AiddError {
  readonly code = "native-plugin-cli";
  constructor(readonly detail: string) {
    super();
  }
}

/** A host-facing registration must be keyed by the catalog's own declared name, and an
 * unreadable catalog leaves this CLI no other fact to key it by. Registering nothing beats
 * writing this project's local alias: a manifest that guessed would claim a `hostName` the
 * host was never asked to hold. */
export class UnreadableBuiltCatalogError extends AiddError {
  readonly code = "unreadable-built-catalog";
  constructor(readonly path: string) {
    super();
  }
}

/** A registration, refresh or withdrawal refused to touch a host catalogue or ref, or to go on
 * without a host that could not answer. `detail` is the sentence naming what a person must
 * reconcile. It is also the `message`: a clean reports each refusal it collected by its message,
 * so the sentence must survive there as it did before the refusal was typed. */
export class RegistrationRefusedError extends AiddError {
  readonly code = "registration-refused";
  constructor(readonly detail: string) {
    super();
    this.message = detail;
  }
}
