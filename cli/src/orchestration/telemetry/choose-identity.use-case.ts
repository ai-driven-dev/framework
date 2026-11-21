import type { CheckIdentity } from "../../contexts/telemetry/application/identity/check-identity.use-case.js";
import type {
  DecideIdentity,
  IdentityDecision,
} from "../../contexts/telemetry/application/identity/decide-identity.use-case.js";
import type { IdentityChoice } from "../../contexts/telemetry/application/switch/enable-telemetry.use-case.js";
import type { Prompter } from "../ports/prompter.js";

export interface ChooseIdentityRequest {
  readonly cwd: string;
  readonly yes: boolean;
  readonly as?: string;
  readonly anonymous: boolean;
  /** Called each time a typed identifier is refused, before it is asked for again. */
  readonly onRefused: () => void;
}

interface ChooseIdentityDeps {
  readonly decideIdentity: Pick<DecideIdentity, "execute">;
  readonly checkIdentity: Pick<CheckIdentity, "execute">;
  readonly prompter: Prompter;
}

type Asked = Extract<IdentityDecision, { readonly ask: unknown }>;

const isAsked = (decision: IdentityDecision): decision is Asked =>
  typeof decision === "object" && "ask" in decision;

/** Who the clone is measured as: what the telemetry context decides, or the person's answer when
 * it leaves the question open. */
export class ChooseIdentity {
  constructor(private readonly deps: ChooseIdentityDeps) {}

  async execute({ onRefused, ...request }: ChooseIdentityRequest): Promise<IdentityChoice> {
    const decision = await this.deps.decideIdentity.execute(request);
    if (!isAsked(decision)) return decision;
    const answer = await this.ask(decision.ask.proposal);
    return answer === "another" ? this.typed(onRefused) : answer;
  }

  private ask(proposal: string | null): Promise<IdentityChoice | "another"> {
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
