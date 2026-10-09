import type { RepositoryDeclarations } from "../../domain/ports/forget/repository-declarations.js";
import { runGit } from "../run-git.js";

/** `git config` finds nothing: not a failure. */
const NO_MATCH = 1;
/** `git config --unset` of a key that is not there. */
const KEY_ABSENT = 5;
/** The three keys a declaration writes, as git lists them: the variable in lower case, the
 * branch name, which may hold dots, kept as it is. */
const KEYS = "^branch\\..+\\.(aiddtask|aiddticket|aidddeclaredat)$";

export class RepositoryDeclarationsAdapter implements RepositoryDeclarations {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async count(root: string): Promise<number> {
    return this.keys(root).length;
  }

  async clear(root: string): Promise<number> {
    const keys = this.keys(root);
    for (const key of keys) {
      // After `--`, so a branch name that starts with a dash is never read as an option.
      const run = runGit(this.env, root, ["config", "--local", "--unset-all", "--", key]);
      if (run.status !== 0 && run.status !== KEY_ABSENT) {
        throw new Error(`git config ${key} could not be removed in ${root}`);
      }
    }
    return keys.length;
  }

  private keys(root: string): string[] {
    const run = runGit(this.env, root, [
      "config",
      "--local",
      "-z",
      "--name-only",
      "--get-regexp",
      KEYS,
    ]);
    if (run.status === NO_MATCH) return [];
    if (run.status !== 0) throw new Error(`git config could not be read in ${root}`);
    return run.stdout.split("\0").filter((key) => key !== "");
  }
}
