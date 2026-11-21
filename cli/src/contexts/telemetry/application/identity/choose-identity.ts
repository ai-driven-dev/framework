import { InputRequiredError } from "../../../../shared/domain/shared.error.js";
import type { Prompter } from "../../../../shared/ports/prompter.js";
import type { IdentityChoice } from "../switch/enable-telemetry.js";
import type { CheckIdentity } from "./check-identity.js";
import type { ManageIdentity } from "./manage-identity.js";
import type { ProposeIdentity } from "./propose-identity.js";

export interface ChooseIdentityCommand {
  readonly cwd: string;
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
  /** Called each time a typed identifier is refused, before it is asked for again. */
  readonly onRefused: () => void;
}

interface ChooseIdentityDeps {
  readonly manageIdentity: Pick<ManageIdentity, "execute">;
  readonly proposeIdentity: Pick<ProposeIdentity, "execute">;
  readonly checkIdentity: Pick<CheckIdentity, "execute">;
  readonly prompter: Prompter;
}

/** Who the clone is measured as: a flag's answer, the identity already set, or the person's
 * answer. Refused when `--yes` leaves none of them. */
export class ChooseIdentity {
  constructor(private readonly deps: ChooseIdentityDeps) {}

  async execute({
    cwd,
    yes,
    as,
    anonymous,
    onRefused,
  }: ChooseIdentityCommand): Promise<IdentityChoice> {
    if (as !== undefined) return { set: as };
    if (anonymous) return "none";
    if ((await this.deps.manageIdentity.execute({ action: "show" })).status === "set")
      return "keep";
    if (yes) {
      throw new InputRequiredError(
        "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
      );
    }
    const answer = await this.ask(cwd);
    return answer === "another" ? this.typed(onRefused) : answer;
  }

  private async ask(cwd: string): Promise<IdentityChoice | "another"> {
    const proposal = await this.deps.proposeIdentity.execute({ cwd });
    return this.deps.prompter.select<IdentityChoice | "another">(
      "How should your own measurement name you? The identity stays on this machine.",
      [
        ...(proposal === null
          ? []
          : [{ name: `As "${proposal}", your git name`, value: { set: proposal } }]),
        { name: "As another identifier, typed next", value: "another" },
        { name: "Anonymously", value: "none" },
      ]
    );
  }

  private async typed(onRefused: () => void): Promise<IdentityChoice> {
    for (;;) {
      const typed = await this.deps.prompter.input(
        "Identifier (one non-empty line, at most 128 characters):"
      );
      if (this.deps.checkIdentity.execute({ typed }).status === "valid") return { set: typed };
      onRefused();
    }
  }
}
