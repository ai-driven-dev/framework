import type { Environment } from "../../../../shared/ports/environment.js";
import { personIdOf } from "../../domain/identity/person-identity.js";
import { measurementRefused } from "../../domain/telemetry-consent.js";
import type { GitUserSource } from "../../ports/identity/git-user-source.js";

export interface ProposeIdentityCommand {
  readonly cwd: string;
}

/** The identifier offered to a person who has none yet, or `null` when there is none to offer. */
export class ProposeIdentity {
  constructor(
    private readonly git: GitUserSource,
    private readonly environment: Environment
  ) {}

  async execute({ cwd }: ProposeIdentityCommand): Promise<string | null> {
    if (measurementRefused(this.environment)) return null;
    const user = await this.git.userIn(cwd);
    return user === null ? null : personIdOf(user);
  }
}
