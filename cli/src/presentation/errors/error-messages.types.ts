import type * as auth from "../../contexts/auth/contract/auth.error.js";
import type * as distribution from "../../contexts/distribution/contract/distribution.error.js";
import type * as hostRegistration from "../../contexts/host-registration/contract/host-registration.error.js";
import type * as installation from "../../contexts/installation/contract/installation.error.js";
import type * as machineClaims from "../../contexts/machine-claims/contract/machine-claims.error.js";
import type * as telemetry from "../../contexts/telemetry/contract/errors/telemetry.error.js";
import type * as tools from "../../contexts/tools/contract/errors/tools.error.js";
import type * as translate from "../../contexts/translate/contract/translate.error.js";
import type * as update from "../../contexts/update/contract/update.error.js";
import type * as orchestration from "../../orchestration/orchestration.error.js";
import type * as shared from "../../shared/domain/shared.error.js";
import type { AiddError } from "../../shared/domain/shared.error.js";
import type * as presentation from "../presentation.error.js";

/** The words of a nested cause, so a message can name what failed beneath it. */
export type CauseWords = (cause: unknown) => string;

/** One entry says what its own error class carries; a method signature lets the table widen to any code. */
export interface Words {
  say(error: AiddError, words: CauseWords): string;
}

type Classes<Module> = Extract<Module[keyof Module], new (...args: never[]) => AiddError>;

/** The words of each error of the owners, keyed by the code the error carries. */
export type MessagesOf<Errors extends AiddError> = {
  [Error in Errors as Error["code"]]: (error: Error, words: CauseWords) => string;
};

export type SharedOwners =
  | InstanceType<Classes<typeof shared>>
  | InstanceType<Classes<typeof auth>>
  | InstanceType<Classes<typeof update>>
  | InstanceType<Classes<typeof telemetry>>;

export type InstallationOwners =
  | InstanceType<Classes<typeof installation>>
  | InstanceType<Classes<typeof hostRegistration>>
  | InstanceType<Classes<typeof machineClaims>>
  | InstanceType<Classes<typeof orchestration>>;

export type CatalogOwners =
  | InstanceType<Classes<typeof distribution>>
  | InstanceType<Classes<typeof translate>>
  | InstanceType<Classes<typeof tools>>;

export type PresentationOwners = InstanceType<Classes<typeof presentation>>;
