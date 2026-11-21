import { IdentityOffWithIdentifierError } from "../../domain/telemetry.error.js";
import type { ManageIdentityRequest } from "./manage-identity.use-case.js";

export interface ParseIdentityFlagsRequest {
  readonly off: boolean;
  readonly id: string | undefined;
}

/** What a person typed for `telemetry identity`, as the identity action to run: remove it, set
 * it to what was typed, or show it. An identifier given with `--off` is refused. */
export class ParseIdentityFlags {
  execute({ off, id }: ParseIdentityFlagsRequest): ManageIdentityRequest {
    if (off && id !== undefined) throw new IdentityOffWithIdentifierError();
    if (off) return { action: "off" };
    return id === undefined ? { action: "show" } : { action: "set", typed: id };
  }
}
