import type { GitUserSource } from "../../domain/ports/identity/git-user-source.js";
import { runGit } from "../run-git.js";

export class GitUserSourceAdapter implements GitUserSource {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async userIn(cwd: string): Promise<string | null> {
    for (const key of ["user.name", "user.email"]) {
      // A key not set, or a config git cannot read, prints nothing: `on` refuses the latter.
      const value = runGit(this.env, cwd, ["config", "--get", key]).stdout.trim();
      if (value !== "") return value;
    }
    return null;
  }
}
