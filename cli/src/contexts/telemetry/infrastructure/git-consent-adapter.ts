import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { ConsentWriter } from "../domain/ports/switch/consent-writer.js";
import { CONSENT_KEY, type ConsentReading } from "../domain/telemetry-consent.js";
import { runGit } from "./run-git.js";

/** `git config` finds nothing: the key is simply not set. */
const NOT_SET = 1;

/** Consent as `git config --local aidd.telemetry`. `--local` is the repository's own config,
 * the one file a repository and all its linked worktrees share, and no commit carries it. */
export class GitConsentAdapter implements ConsentSource, ConsentWriter {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async read(root: string): Promise<ConsentReading> {
    const run = runGit(this.env, root, ["config", "--local", "--get", CONSENT_KEY]);
    if (run.status === 0) return { kind: "value", value: run.stdout.replace(/\r?\n$/u, "") };
    return run.status === NOT_SET ? { kind: "value", value: null } : { kind: "unreadable" };
  }

  async set(root: string, value: string): Promise<void> {
    const run = runGit(this.env, root, ["config", "--local", CONSENT_KEY, value]);
    if (run.status !== 0) throw new Error(`git config ${CONSENT_KEY} could not be set in ${root}`);
  }
}
