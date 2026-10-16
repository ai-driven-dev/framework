import { personIdOf } from "../../domain/identity/person-identity.js";
import type { GitUserSource } from "../../domain/ports/identity/git-user-source.js";

/** The identifier offered to a person who has none yet, or `null` when there is none to offer. */
export class ProposeIdentityUseCase {
  constructor(
    private readonly git: GitUserSource,
    private readonly refusedByEnvironment: boolean
  ) {}

  async execute(cwd: string): Promise<string | null> {
    if (this.refusedByEnvironment) return null;
    const user = await this.git.userIn(cwd);
    return user === null ? null : personIdOf(user);
  }
}
