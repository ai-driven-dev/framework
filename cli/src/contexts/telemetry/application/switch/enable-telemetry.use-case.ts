import { personIdOf } from "../../domain/identity/person-identity.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { PersonIdentityStore } from "../../ports/identity/person-identity-store.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";
import { readCloneConsent } from "./clone-consent.js";
import type { GrantConsent } from "./grant-consent.use-case.js";
import type { RememberOwnRoot } from "./remember-own-root.use-case.js";

/** Who the clone is measured as: the identity already set, none, or the one the person chose. */
export type IdentityChoice = "keep" | "none" | { readonly set: string };

/** Who the clone is measured as, `null` for nobody, and who it was before this `on`. */
export interface OnIdentity {
  readonly personId: string | null;
  readonly previous: string | null;
}

export interface EnableTelemetryRequest {
  readonly cwd: string;
  readonly choice: IdentityChoice;
}

export type EnableTelemetryResult =
  | {
      readonly status: "refused";
      /** `unidentified-clone`: the file system gives the clone's git dir no identity, so
       * nothing measured could be told to be its own. `damaged-consent-log`: what the log says
       * cannot be trusted, so nothing is added to it; `forget --yes` is the way out. */
      readonly reason:
        | "outside-repository"
        | "unreadable-git-config"
        | "unidentified-clone"
        | "damaged-consent-log"
        | "invalid-identity"
        | "identity-set";
    }
  | {
      readonly status: "on";
      /** `false` when the clone already granted this version. */
      readonly consentWritten: boolean;
      /** The clone's root, where Claude Code's project settings are read. */
      readonly root: string;
      readonly identity: OnIdentity;
    };

interface EnableTelemetryDeps {
  readonly locator: RepositoryLocator;
  readonly consents: ConsentSource;
  readonly grant: GrantConsent;
  readonly roots: RememberOwnRoot;
  readonly identities: PersonIdentityStore;
}

/** Opts a clone in, in its own git config. Measurement starts here: nothing made before is read
 * back. */
export class EnableTelemetry {
  constructor(private readonly deps: EnableTelemetryDeps) {}

  async execute({ cwd, choice }: EnableTelemetryRequest): Promise<EnableTelemetryResult> {
    const previous = await this.deps.identities.read();
    const named = chosenIdentity(choice, previous);
    if ("status" in named) return named;
    const clone = await readCloneConsent(this.deps.locator, this.deps.consents, cwd);
    if (clone.status === "refused") return clone;
    const { located } = clone;
    if (located.clone === null) return refusal("unidentified-clone");
    const consentWritten = await this.deps.grant.execute({
      root: located.root,
      identity: located.clone,
    });
    if (consentWritten === "damaged") return refusal("damaged-consent-log");
    // Written only once the clone is on: a refused `on` leaves the identity as it was.
    if (named.chosen !== null) await this.deps.identities.write(named.chosen);
    await this.deps.roots.execute(located);
    return {
      status: "on",
      consentWritten,
      root: located.root,
      identity: { personId: choice === "keep" ? previous : named.chosen, previous },
    };
  }
}

type Refused = Extract<EnableTelemetryResult, { status: "refused" }>;

const refusal = (reason: Refused["reason"]): Refused => ({ status: "refused", reason });

/** The identifier a choice names, `null` for none, or why the choice cannot be followed. */
function chosenIdentity(
  choice: IdentityChoice,
  previous: string | null
): { readonly chosen: string | null } | Refused {
  if (choice === "none") return previous === null ? { chosen: null } : refusal("identity-set");
  if (choice === "keep") return { chosen: null };
  const chosen = personIdOf(choice.set);
  return chosen === null ? refusal("invalid-identity") : { chosen };
}
