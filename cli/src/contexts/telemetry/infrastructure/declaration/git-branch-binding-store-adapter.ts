import type { TaskDeclaration } from "../../domain/declaration/task-declaration.js";
import type { BranchBindingStore, BranchHeads } from "../../domain/ports/branch-binding-store.js";
import { runGit } from "../run-git.js";

const NOT_SYMBOLIC = 1;
/** `git config --unset` of a key that is not there. */
const KEY_ABSENT = 5;

/** Keeps a branch's declaration in the repository's own git config: `branch.<name>.aiddTask`,
 * `aiddTicket` and `aiddDeclaredAt`. */
export class GitBranchBindingStoreAdapter implements BranchBindingStore {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async heads(root: string): Promise<BranchHeads> {
    return {
      head: this.symbolicRef(root, "HEAD"),
      originHead: this.symbolicRef(root, "refs/remotes/origin/HEAD"),
    };
  }

  /** `aiddDeclaredAt` goes last: a branch counts as declared only once the rest is in place,
   * so a crash in between leaves it undeclared rather than half declared. */
  async declare(root: string, branch: string, declaration: TaskDeclaration): Promise<void> {
    this.setOrUnset(root, branch, "aiddTask", declaration.task);
    this.setOrUnset(root, branch, "aiddTicket", declaration.ticket);
    this.setOrUnset(root, branch, "aiddDeclaredAt", declaration.declared_at);
  }

  private symbolicRef(root: string, ref: string): string | null {
    const run = runGit(this.env, root, ["symbolic-ref", "--quiet", ref]);
    if (run.status === 0) return run.stdout.trim();
    if (run.status === NOT_SYMBOLIC) return null;
    throw new Error(`git could not read ${ref} in ${root}`);
  }

  private setOrUnset(root: string, branch: string, variable: string, value: string | null): void {
    const key = `branch.${branch}.${variable}`;
    // After `--`, so a value that starts with a dash is never read as an option.
    const args =
      value === null
        ? ["config", "--local", "--unset", "--", key]
        : ["config", "--local", "--", key, value];
    const run = runGit(this.env, root, args);
    if (run.status === 0 || (value === null && run.status === KEY_ABSENT)) return;
    throw new Error(`git config ${key} failed in ${root}`);
  }
}
