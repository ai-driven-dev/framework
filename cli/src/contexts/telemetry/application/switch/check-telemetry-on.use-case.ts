import { InputRequiredError } from "../../../../shared/domain/shared.error.js";
import {
  ConflictingIdentityFlagsError,
  InvalidIdentityError,
} from "../../domain/telemetry.error.js";
import type { CheckIdentity } from "../identity/check-identity.use-case.js";

export interface CheckTelemetryOnRequest {
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
  /** Whether a person can be asked. */
  readonly interactive: boolean;
}

/** What a request to turn measurement on can be told before anything is wired: it names the
 * person and nobody at once, names them with an identifier that cannot, or asks where nobody
 * can answer. Each is refused. */
export class CheckTelemetryOn {
  constructor(private readonly checkIdentity: Pick<CheckIdentity, "execute">) {}

  execute({ yes, as, anonymous, interactive }: CheckTelemetryOnRequest): void {
    if (as !== undefined && anonymous) throw new ConflictingIdentityFlagsError();
    if (as !== undefined && this.checkIdentity.execute({ typed: as }).status === "refused") {
      throw new InvalidIdentityError();
    }
    if (!yes && !interactive) {
      throw new InputRequiredError(
        "Nothing to ask in a non-interactive run: pass --yes to turn measurement on."
      );
    }
  }
}
