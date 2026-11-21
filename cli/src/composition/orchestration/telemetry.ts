import type { CheckIdentity } from "../../contexts/telemetry/application/identity/check-identity.use-case.js";
import type { DecideIdentity } from "../../contexts/telemetry/application/identity/decide-identity.use-case.js";
import type { Prompter } from "../../orchestration/ports/prompter.js";
import { ChooseIdentity } from "../../orchestration/telemetry/choose-identity.use-case.js";

/** The question put to a person about who their measurement names, over what telemetry decides. */
export function wireChooseIdentity(parts: {
  decideIdentity: Pick<DecideIdentity, "execute">;
  checkIdentity: Pick<CheckIdentity, "execute">;
  prompter: Prompter;
}): ChooseIdentity {
  return new ChooseIdentity(parts);
}
