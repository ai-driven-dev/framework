import { type CloneIdentity, cloneKey } from "../domain/consent/clone-identity.js";
import type { ConsentHistory } from "../domain/ports/consent-history.js";
import type { ConsentSource } from "../domain/ports/consent-source.js";
import type { RepositoryLocator } from "../domain/ports/repository-locator.js";
import type { ResolutionStore } from "../domain/ports/resolution-store.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import {
  cwdKey,
  type NotStoredReason,
  ownerAt,
  type RepositoryResolution,
  resolutionKey,
  sameResolution,
} from "../domain/repository-resolution.js";
import { consentOf } from "../domain/telemetry-consent.js";
import { ConsentLog } from "./consent-log.js";

export type DirectoryOutcome =
  | {
      readonly stored: RepositoryResolution;
      /** Resolved from the directory as it stands, not from what was remembered of it. */
      readonly live: boolean;
    }
  | { readonly skipped: NotStoredReason };

/** What the machine decides for a run: how it spells a directory, and what time it is. */
export interface ResolutionEnvironment {
  /** macOS and Windows file systems answer one directory to several spellings. */
  readonly caseInsensitiveFileSystem: boolean;
  readonly now: () => Date;
}

/** What is known of a clone's consent now. */
type CloneState = "granted" | "absent" | "unreadable" | "gone";

type Directory =
  | { readonly skipped: NotStoredReason }
  | {
      /** Every clone the directory was seen alive in. */
      readonly owners: readonly [RepositoryResolution, ...RepositoryResolution[]];
      /** The one it is alive in now, when it is. */
      readonly current: RepositoryResolution | null;
    };

/** Decides, for a billed call, whether it is stored: the rule is in the usage contract. The
 * directory it was made in must have been seen alive, in a clone; that clone is the one
 * answering now, or, when it is gone, the one remembered; and its consent must have covered the
 * call's time. A clone is told from another made at the same path by its identity, never by its
 * path or its remote. */
export class DirectoryResolver {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consentSource: ConsentSource,
    private readonly store: ResolutionStore,
    private readonly history: ConsentHistory,
    private readonly environment: ResolutionEnvironment
  ) {}

  /** One run, under the ledger's lock. Every clone whose consent is open is looked at first, so
   * that a clone that stopped consenting, or went, is closed whether or not a call of it is
   * read. */
  async open(): Promise<ResolutionRun> {
    const run = new ResolutionRun(
      this.locator,
      this.consentSource,
      this.store,
      await this.store.load(),
      await ConsentLog.load(this.history),
      this.environment
    );
    await run.observeOpenConsents();
    return run;
  }
}

export class ResolutionRun {
  private changed = false;
  private readonly directories = new Map<string, Directory>();
  private readonly states = new Map<string, CloneState>();

  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consentSource: ConsentSource,
    private readonly store: ResolutionStore,
    private readonly remembered: Map<string, RepositoryResolution>,
    private readonly consents: ConsentLog,
    private readonly environment: ResolutionEnvironment
  ) {}

  /** Keeps what this run learned. */
  async close(): Promise<void> {
    if (this.changed) await this.store.save(this.remembered);
  }

  async observeOpenConsents(): Promise<void> {
    for (const clone of this.consents.openClones()) await this.stateOf(clone);
  }

  /** The verdict on a call made in `cwd` at `at`. */
  async resolve(cwd: string, at: string): Promise<DirectoryOutcome> {
    const directory = await this.directoryOf(cwd);
    if ("skipped" in directory) return directory;
    const instant = Date.parse(at);
    const owner = ownerAt(directory.owners, instant);
    const state = await this.stateOf(owner.clone);
    if (state === "unreadable") return { skipped: "unreadable-consent" };
    if (state === "absent" || !this.consents.covers(owner.clone, instant)) {
      return { skipped: "no-consent" };
    }
    // Alive in the clone that answers, which says yes: so what was read now is what is there.
    const live = directory.current !== null && sameOwner(directory.current, owner);
    return { stored: owner, live };
  }

  private async directoryOf(cwd: string): Promise<Directory> {
    const held = this.directories.get(cwd);
    if (held !== undefined) return held;
    const directory = await this.look(cwd);
    this.directories.set(cwd, directory);
    return directory;
  }

  private async look(cwd: string): Promise<Directory> {
    const dir = cwdKey(cwd, this.environment.caseInsensitiveFileSystem);
    const located = await this.locator.locate(cwd);
    if (located.status === "gone") {
      const [first, ...others] = this.ownersOf(dir);
      return first === undefined
        ? { skipped: "never-seen-alive" }
        : { owners: [first, ...others], current: null };
    }
    if (located.status === "outside-repository") return { skipped: "outside-repo" };
    // A repository with no origin and no commit has nothing to be named by.
    const id = repositoryIdOf(located);
    if (id === null) return { skipped: "outside-repo" };
    // A clone the platform cannot identify cannot be told from another: fail closed.
    if (located.clone === null) return { skipped: "unreadable-consent" };
    const current = this.remember(dir, id, located.root, located.clone);
    const others = this.ownersOf(dir).filter((owner) => !sameOwner(owner, current));
    return { owners: [current, ...others], current };
  }

  /** Keeps the first sighting of a directory in a clone, and what it was found to be since. */
  private remember(
    dir: string,
    repositoryId: string,
    root: string,
    clone: CloneIdentity
  ): RepositoryResolution {
    const key = resolutionKey(dir, clone);
    const held = this.remembered.get(key);
    const seen = {
      dir,
      repository_id: repositoryId,
      root,
      clone,
      seen_at: held?.seen_at ?? this.environment.now().toISOString(),
    };
    if (sameResolution(held, seen)) return seen;
    this.remembered.set(key, seen);
    this.changed = true;
    return seen;
  }

  private ownersOf(dir: string): RepositoryResolution[] {
    return [...this.remembered.values()].filter((resolution) => resolution.dir === dir);
  }

  /** What a clone says now. A clone that is gone, or no longer consents, has its consent closed
   * at this moment: the earliest anyone knows. */
  private async stateOf(clone: CloneIdentity): Promise<CloneState> {
    const key = cloneKey(clone);
    const held = this.states.get(key);
    if (held !== undefined) return held;
    const reading = await this.consentSource.readClone(clone);
    const state: CloneState = reading.kind === "gone" ? "gone" : consentOf(reading);
    if (state === "gone" || state === "absent")
      await this.consents.close(clone, this.environment.now());
    this.states.set(key, state);
    return state;
  }
}

function sameOwner(a: RepositoryResolution, b: RepositoryResolution): boolean {
  return cloneKey(a.clone) === cloneKey(b.clone);
}
