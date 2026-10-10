import type {
  RepositoryDeclarations,
  RepositoryKeys,
} from "../../domain/ports/forget/repository-declarations.js";
import { CONSENT_KEY } from "../../domain/telemetry-consent.js";
import { runGit } from "../run-git.js";

/** `git config` finds nothing: not a failure. */
const NO_MATCH = 1;
/** `git config --unset` of a key that is not there. */
const KEY_ABSENT = 5;
/** The three keys a declaration writes, as git lists them: the variable in lower case, the
 * branch name, which may hold dots, kept as it is. */
const TASK_KEYS = "^branch\\..+\\.(aiddtask|aiddticket|aidddeclaredat)$";

export class RepositoryDeclarationsAdapter implements RepositoryDeclarations {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async count(root: string): Promise<RepositoryKeys> {
    const { taskKeys, consent } = this.held(root);
    return { taskKeys, consent };
  }

  async clear(root: string): Promise<RepositoryKeys> {
    const held = this.held(root);
    for (const key of [...held.taskNames, ...(held.consent ? [CONSENT_KEY] : [])]) {
      // After `--`, so a branch name that starts with a dash is never read as an option.
      const run = runGit(this.env, root, ["config", "--local", "--unset-all", "--", key]);
      if (run.status !== 0 && run.status !== KEY_ABSENT) {
        throw new Error(`git config ${key} could not be removed in ${root}`);
      }
    }
    return { taskKeys: held.taskKeys, consent: held.consent };
  }

  private held(root: string): RepositoryKeys & { taskNames: string[] } {
    const taskNames = this.names(root, TASK_KEYS);
    const consent = this.names(root, `^${CONSENT_KEY.replace(".", "\\.")}$`).length > 0;
    return { taskNames, taskKeys: taskNames.length, consent };
  }

  private names(root: string, pattern: string): string[] {
    const run = runGit(this.env, root, [
      "config",
      "--local",
      "-z",
      "--name-only",
      "--get-regexp",
      pattern,
    ]);
    if (run.status === NO_MATCH) return [];
    if (run.status !== 0) throw new Error(`git config could not be read in ${root}`);
    return run.stdout.split("\0").filter((key) => key !== "");
  }
}
