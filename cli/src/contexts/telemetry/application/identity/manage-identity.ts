import { personIdOf } from "../../domain/identity/person-identity.js";
import type { PersonIdentityStore } from "../../ports/identity/person-identity-store.js";

export type ManageIdentityCommand =
  | { readonly action: "show" }
  | { readonly action: "set"; readonly typed: string }
  | { readonly action: "off" };

export type ManageIdentityResult =
  | { readonly status: "set"; readonly personId: string }
  | { readonly status: "unset" }
  | { readonly status: "removed" }
  | { readonly status: "refused" };

/** Who, if anyone, the measurement names. A person is named only by choosing to be. */
export class ManageIdentity {
  constructor(private readonly store: PersonIdentityStore) {}

  async execute(command: ManageIdentityCommand): Promise<ManageIdentityResult> {
    if (command.action === "set") return this.set(command.typed);
    return command.action === "off" ? this.off() : this.show();
  }

  private async show(): Promise<ManageIdentityResult> {
    const personId = await this.store.read();
    return personId === null ? { status: "unset" } : { status: "set", personId };
  }

  private async set(typed: string): Promise<ManageIdentityResult> {
    const personId = personIdOf(typed);
    if (personId === null) return { status: "refused" };
    await this.store.write(personId);
    return { status: "set", personId };
  }

  private async off(): Promise<ManageIdentityResult> {
    return (await this.store.remove()) ? { status: "removed" } : { status: "unset" };
  }
}
