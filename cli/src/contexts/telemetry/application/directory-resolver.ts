import { type CloneIdentity, cloneKey, sameClone } from "../domain/consent/clone-identity.js";
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
import { tokenOfKey } from "../domain/telemetry-consent.js";
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

type Directory =
  | { readonly skipped: NotStoredReason }
  | {
      /** Every clone the directory was seen alive in. */
      readonly owners: readonly [RepositoryResolution, ...RepositoryResolution[]];
      /** The one it is alive in now, when it is. */
      readonly current: RepositoryResolution | null;
    };

/** Decides, for a billed call, whether it is stored: the rule is in the usage contract. The
 * directory it was made in must have been seen alive, in a clone, and that clone must have had
 * an open consent interval at the call's time. A clone is told from another made at the same
 * path by its identity, never by its path or its remote. The clone's own key is not asked at
 * the call: the intervals are the truth, and an interval is closed as soon as anything sees the
 * key stop naming it. */
export class DirectoryResolver {
  constructor(
    private readonly locator: RepositoryLocator,
    private readonly consentSource: ConsentSource,
    private readonly store: ResolutionStore,
    private readonly history: ConsentHistory,
    private readonly environment: ResolutionEnvironment
  ) {}

  /** One run, under the ledger's lock. Every open interval is looked at first, so that a clone
   * that stopped consenting, or went, is closed whether or not a call of it is read. */
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
  /** Clones whose git config could not be read: their intervals are neither kept nor closed. */
  private readonly unreadable = new Set<string>();

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

  /** Closes, at this moment, the earliest anyone knows, every open interval whose clone is
   * gone, is another clone now, or no longer names the interval's token in its key. */
  async observeOpenConsents(): Promise<void> {
    for (const interval of this.consents.openIntervals()) {
      const reading = await this.consentSource.readClone(interval.clone);
      if (reading.kind === "unreadable") {
        this.unreadable.add(cloneKey(interval.clone));
        continue;
      }
      // A clone that is gone has no key, so it names no token either.
      const named = reading.kind === "value" && tokenOfKey(reading.value) === interval.token;
      if (!named) await this.consents.close(interval.token, this.environment.now());
    }
  }

  /** The verdict on a call made in `cwd` at `at`. */
  async resolve(cwd: string, at: string): Promise<DirectoryOutcome> {
    // A consent log that cannot be read says nothing for any clone.
    if (this.consents.damaged) return { skipped: "unreadable-consent" };
    const directory = await this.directoryOf(cwd);
    if ("skipped" in directory) return directory;
    const instant = Date.parse(at);
    const owner = ownerAt(directory.owners, instant);
    if (this.unreadable.has(cloneKey(owner.clone))) return { skipped: "unreadable-consent" };
    if (!this.consents.covers(owner.clone, instant)) return { skipped: "no-consent" };
    const live = directory.current !== null && sameClone(directory.current.clone, owner.clone);
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
    const others = this.ownersOf(dir).filter((owner) => !sameClone(owner.clone, current.clone));
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
}
