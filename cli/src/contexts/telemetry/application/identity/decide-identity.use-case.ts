import { InputRequiredError } from "../../../../shared/domain/shared.error.js";
import type { IdentityChoice } from "../switch/enable-telemetry.use-case.js";
import type { ManageIdentity } from "./manage-identity.use-case.js";
import type { ProposeIdentity } from "./propose-identity.use-case.js";

export interface DecideIdentityRequest {
  readonly cwd: string;
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
}

/** Who the clone is measured as, or the question to put to the person, with the identifier to
 * offer first (`null` when there is none). */
export type IdentityDecision =
  | IdentityChoice
  | { readonly ask: { readonly proposal: string | null } };

interface DecideIdentityDeps {
  readonly manageIdentity: Pick<ManageIdentity, "execute">;
  readonly proposeIdentity: Pick<ProposeIdentity, "execute">;
}

/** Who the clone is measured as: a flag's answer, the identity already set, or a question for
 * the person. Refused when `--yes` leaves none of them. */
export class DecideIdentity {
  constructor(private readonly deps: DecideIdentityDeps) {}

  async execute({ cwd, yes, as, anonymous }: DecideIdentityRequest): Promise<IdentityDecision> {
    if (as !== undefined) return { set: as };
    if (anonymous) return "none";
    if ((await this.deps.manageIdentity.execute({ action: "show" })).status === "set")
      return "keep";
    if (yes) {
      throw new InputRequiredError(
        "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
      );
    }
    return { ask: { proposal: await this.deps.proposeIdentity.execute({ cwd }) } };
  }
}
