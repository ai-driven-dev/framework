import {
  type BranchConfigBinding,
  oldestReflogTime,
  parseBranchConfig,
} from "../domain/branch-binding.js";
import type { BranchBindingSource } from "../domain/ports/branch-binding-source.js";
import { runGit } from "./run-git.js";

const NO_MATCH = 1;
const DECLARATION_KEYS = "^branch\\..*\\.aidd(task|ticket|declaredat)$";

/** Reads branch declarations from a repository's own git config and reflog. */
export class GitBranchBindingSourceAdapter implements BranchBindingSource {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async bindings(root: string): Promise<readonly BranchConfigBinding[]> {
    const run = runGit(this.env, root, [
      "config",
      "--local",
      "-z",
      "--get-regexp",
      DECLARATION_KEYS,
    ]);
    if (run.status === NO_MATCH) return [];
    if (run.status !== 0) throw new Error(`git config could not be read in ${root}`);
    return parseBranchConfig(run.stdout);
  }

  async createdAt(root: string, branch: string): Promise<string | null> {
    // Named in full, so a branch name can never be read as an option.
    const run = runGit(this.env, root, [
      "reflog",
      "show",
      "--date=iso-strict",
      "--format=%gd",
      `refs/heads/${branch}`,
    ]);
    // A branch with no reflog makes git fail with nothing on stdout.
    return oldestReflogTime(run.stdout);
  }
}
