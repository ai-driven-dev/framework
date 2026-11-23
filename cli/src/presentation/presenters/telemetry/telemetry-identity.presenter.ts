import type { ManageIdentityResult } from "../../../contexts/telemetry/application/identity/manage-identity.use-case.js";
import { MAX_IDENTITY_LENGTH } from "../../../contexts/telemetry/contract/identity-limit.js";
import type { Output } from "../../terminal/output.model.js";

/** What an identifier must be to name a person. */
export const IDENTITY_RULE = `An identity is one non-empty line of at most ${MAX_IDENTITY_LENGTH} characters.`;

export function printIdentityResult(output: Output, result: ManageIdentityResult): void {
  switch (result.status) {
    case "set":
      output.success(`Measurement names you as "${result.personId}". Stop with \`--off\`.`);
      return;
    case "removed":
      output.success('Identity removed: the person axis shows "anonymous".');
      return;
    case "unset":
      output.info(
        'No identity is set: the person axis shows "anonymous". Choose one with `aidd telemetry identity <id>`.'
      );
      return;
    case "refused":
      output.error(IDENTITY_RULE);
  }
}
