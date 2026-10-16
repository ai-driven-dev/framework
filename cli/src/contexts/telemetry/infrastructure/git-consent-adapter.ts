import { join } from "node:path";
import { type CloneIdentity, sameClone } from "../domain/consent/clone-identity.js";
import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { ConsentWriter } from "../domain/ports/switch/consent-writer.js";
import {
  type CloneConsentReading,
  CONSENT_KEY,
  type ConsentReading,
} from "../domain/telemetry-consent.js";
import { type CloneIdentityReader, readCloneIdentity } from "./consent/clone-identity-reader.js";
import { type GitRun, runGit } from "./run-git.js";

/** `git config` finds nothing: the key is simply not set. */
const NOT_SET = 1;

function readingOf(run: GitRun): ConsentReading {
  if (run.status === 0) return { kind: "value", value: run.stdout.replace(/\r?\n$/u, "") };
  return run.status === NOT_SET ? { kind: "value", value: null } : { kind: "unreadable" };
}

/** Consent as `git config --local aidd.telemetry`. `--local` is the repository's own config,
 * the one file a repository and all its linked worktrees share, and no commit carries it. */
export class GitConsentAdapter implements ConsentSource, ConsentWriter {
  /** `env` carries none of git's own variables, which would point it at another repository. */
  constructor(
    private readonly env: NodeJS.ProcessEnv,
    private readonly identify: CloneIdentityReader = readCloneIdentity
  ) {}

  async read(root: string): Promise<ConsentReading> {
    return readingOf(runGit(this.env, root, ["config", "--local", "--get", CONSENT_KEY]));
  }

  async readClone(clone: CloneIdentity): Promise<CloneConsentReading> {
    const now = await this.identify(clone.path);
    // A directory the platform can no longer identify, or cannot look at, is not known to be
    // this clone, nor known not to be: it grants nothing, and it is not called gone.
    if (now === "unidentified") return { kind: "unreadable" };
    if (now === null) return { kind: "absent" };
    if (!sameClone(clone, now)) return { kind: "replaced" };
    const file = join(clone.path, "config");
    return readingOf(
      runGit(this.env, clone.path, ["config", "--file", file, "--get", CONSENT_KEY])
    );
  }

  async set(root: string, value: string): Promise<void> {
    const run = runGit(this.env, root, ["config", "--local", CONSENT_KEY, value]);
    if (run.status !== 0) throw new Error(`git config ${CONSENT_KEY} could not be set in ${root}`);
  }
}
