import { personIdOf } from "../../domain/identity/person-identity.js";
import type { ConsentSource } from "../../ports/consent-source.js";
import type { PersonIdentityStore } from "../../ports/identity/person-identity-store.js";
import type { RepositoryLocator } from "../../ports/repository-locator.js";
import { readCloneConsent } from "./clone-consent.js";
import type { GrantConsent } from "./grant-consent.js";
import type { RememberOwnRoot } from "./remember-own-root.js";

/** Who the clone is measured as: the identity already set, none, or the one the person chose. */
export type IdentityChoice = "keep" | "none" | { readonly set: string };

/** Who the clone is measured as, `null` for nobody, and who it was before this `on`. */
export interface OnIdentity {
  readonly personId: string | null;
  readonly previous: string | null;
}

export interface EnableTelemetryCommand {
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

/** Opts a clone in, in its own git config. Measurement starts here: nothing made before is read
 * back. */
export class EnableTelemetry {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consents: ConsentSource,
    private readonly grant: GrantConsent,
    private readonly roots: RememberOwnRoot,
    private readonly identities: PersonIdentityStore
  ) {}

  async execute({ cwd, choice }: EnableTelemetryCommand): Promise<EnableTelemetryResult> {
    const previous = await this.identities.read();
    const chosen = typeof choice === "object" ? personIdOf(choice.set) : null;
    if (typeof choice === "object" && chosen === null)
      return { status: "refused", reason: "invalid-identity" };
    if (choice === "none" && previous !== null)
      return { status: "refused", reason: "identity-set" };
    const clone = await readCloneConsent(this.locator, this.consents, cwd);
    if (clone.status === "refused") return clone;
    const { located } = clone;
    const identity = located.clone;
    if (identity === null) return { status: "refused", reason: "unidentified-clone" };
    const consentWritten = await this.grant.execute({ root: located.root, identity });
    if (consentWritten === "damaged") return { status: "refused", reason: "damaged-consent-log" };
    // Written only once the clone is on: a refused `on` leaves the identity as it was.
    if (chosen !== null) await this.identities.write(chosen);
    await this.roots.execute(located);

    return {
      status: "on",
      consentWritten,
      root: located.root,
      identity: { personId: choice === "keep" ? previous : chosen, previous },
    };
  }
}
