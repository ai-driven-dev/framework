import { personIdOf } from "../../domain/identity/person-identity.js";
import type { PersonIdentityStore } from "../../domain/ports/identity/person-identity-store.js";

export type IdentityResult =
  | { readonly status: "set"; readonly personId: string }
  | { readonly status: "unset" }
  | { readonly status: "removed" }
  | { readonly status: "refused" };

/** Who, if anyone, the measurement names. A person is named only by choosing to be. */
export class ManageIdentityUseCase {
  constructor(private readonly store: PersonIdentityStore) {}

  async show(): Promise<IdentityResult> {
    const personId = await this.store.read();
    return personId === null ? { status: "unset" } : { status: "set", personId };
  }

  async set(typed: string): Promise<IdentityResult> {
    const personId = personIdOf(typed);
    if (personId === null) return { status: "refused" };
    await this.store.write(personId);
    return { status: "set", personId };
  }

  async off(): Promise<IdentityResult> {
    return (await this.store.remove()) ? { status: "removed" } : { status: "unset" };
  }
}
