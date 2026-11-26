import { personIdOf } from "../../domain/identity/person-identity.js";

export interface CheckIdentityRequest {
  readonly typed: string;
}

export type CheckIdentityResult =
  | { readonly status: "valid"; readonly personId: string }
  | { readonly status: "refused" };

/** Whether what a person typed can name them, with nothing written. */
export class CheckIdentity {
  execute({ typed }: CheckIdentityRequest): CheckIdentityResult {
    const personId = personIdOf(typed);
    return personId === null ? { status: "refused" } : { status: "valid", personId };
  }
}
