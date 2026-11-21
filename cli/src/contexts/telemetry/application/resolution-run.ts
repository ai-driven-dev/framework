import type { NotStoredReason } from "../contract/repository-resolution.js";
import { type CloneIdentity, cloneKey, sameClone } from "../domain/consent/clone-identity.js";
import type { ConsentLog } from "../domain/consent/consent-log.js";
import type { RememberedResolutions } from "../domain/remembered-resolutions.js";
import { repositoryIdOf } from "../domain/repository-identity.js";
import { cwdKey, ownerAt, type RepositoryResolution } from "../domain/repository-resolution.js";
import { tokenOfKey } from "../domain/telemetry-consent.js";
import type { ConsentSource } from "../ports/consent-source.js";
import type { RepositoryLocator } from "../ports/repository-locator.js";

/** What the machine decides for a run: how it spells a directory, and what time it is. */
export interface ResolutionEnvironment {
  /** macOS and Windows file systems answer one directory to several spellings. */
  readonly caseInsensitiveFileSystem: boolean;
  readonly now: () => Date;
}

export type DirectoryOutcome =
  | {
      readonly stored: RepositoryResolution;
      /** Resolved from the directory as it stands, not from what was remembered of it. */
      readonly live: boolean;
    }
  | { readonly skipped: Exclude<NotStoredReason, "unreadable-consent"> }
  | {
      readonly skipped: "unreadable-consent";
      /** A clone remembered at the directory consented at the call's time: what the directory
       * could still turn out to be once it can be read. Never true while the consent log
       * cannot be trusted. */
      readonly mayConsent: boolean;
    };

type Directory =
  | { readonly skipped: NotStoredReason }
  | {
      /** Every clone the directory was seen alive in. */
      readonly owners: readonly [RepositoryResolution, ...RepositoryResolution[]];
      /** The one it is alive in now, when it is. */
      readonly current: RepositoryResolution | null;
    };

/** What a run starts from: the sightings and consent intervals of the machine, and the clones
 * whose git config could not be read, whose intervals are neither kept nor closed. */
export interface ResolutionState {
  readonly remembered: RememberedResolutions;
  readonly consents: ConsentLog;
  readonly unreadable: ReadonlySet<string>;
}

interface ResolutionRunDeps extends ResolutionState {
  readonly locator: RepositoryLocator;
  readonly consentSource: ConsentSource;
  readonly environment: ResolutionEnvironment;
}

type Owned = Exclude<Directory, { skipped: NotStoredReason }>;

/** The verdicts of one run on the directories a billed call was made in. */
export class ResolutionRun {
  private readonly directories = new Map<string, Directory>();
  private remembered: RememberedResolutions;
  private readonly consents: ConsentLog;
  private readonly unreadable: ReadonlySet<string>;
  private readonly locator: RepositoryLocator;
  private readonly consentSource: ConsentSource;
  private readonly environment: ResolutionEnvironment;

  constructor(deps: ResolutionRunDeps) {
    this.remembered = deps.remembered;
    this.consents = deps.consents;
    this.unreadable = deps.unreadable;
    this.locator = deps.locator;
    this.consentSource = deps.consentSource;
    this.environment = deps.environment;
  }

  /** What this run learned about the directories it saw. */
  get learned(): RememberedResolutions {
    return this.remembered;
  }

  /** The earliest instant a call can be covered at, in milliseconds: a transcript last written
   * before it holds nothing to store. Everything when the log cannot be trusted, so that each
   * call is still counted under its reason; nothing when no clone ever opted in. */
  get coveredFrom(): number {
    if (this.consents.damaged) return Number.NEGATIVE_INFINITY;
    return this.consents.firstOpened();
  }

  /** This run's moment, for what has no time of its own. */
  get now(): string {
    return this.environment.now().toISOString();
  }

  /** A line of the consent log was not an event: nothing is stored for any clone. */
  get consentLogDamaged(): boolean {
    return this.consents.damaged;
  }

  /** The verdict on a call made in `cwd` at `at`. */
  async resolve(cwd: string, at: string): Promise<DirectoryOutcome> {
    // A consent log that cannot be read says nothing for any clone.
    if (this.consents.damaged) return this.unreadableAt(cwd, at);
    const directory = await this.directoryOf(cwd);
    if ("skipped" in directory) {
      return directory.skipped === "unreadable-consent"
        ? this.unreadableAt(cwd, at)
        : { skipped: directory.skipped };
    }
    return this.judgeOwner(directory, cwd, at);
  }

  private async judgeOwner(directory: Owned, cwd: string, at: string): Promise<DirectoryOutcome> {
    const instant = Date.parse(at);
    const owner = ownerAt(directory.owners, instant);
    if (this.unreadable.has(cloneKey(owner.clone))) return this.unreadableAt(cwd, at);
    const live = directory.current !== null && sameClone(directory.current.clone, owner.clone);
    if (!this.consents.covers(owner.clone, instant)) {
      const closed = live && (await this.keyNamesClosedInterval(owner.clone));
      return { skipped: closed ? "consent-closed" : "no-consent" };
    }
    return { stored: owner, live };
  }

  /** A verdict no read can give yet. Whether a clone remembered at `cwd` consented at `at`
   * says what the directory could still turn out to be: never true for a directory no read saw
   * readable, nor while the consent log cannot be trusted. */
  private unreadableAt(cwd: string, at: string): DirectoryOutcome {
    const owners = this.remembered.ownersOf(
      cwdKey(cwd, this.environment.caseInsensitiveFileSystem)
    );
    const mayConsent =
      !this.consents.damaged &&
      owners.some((owner) => this.consents.covers(owner.clone, Date.parse(at)));
    return { skipped: "unreadable-consent", mayConsent };
  }

  /** Whether the clone's own key, as it stands, names an interval of it that was closed: it
   * opted in once, so the person is told to run `on` again, not that it never did. */
  private async keyNamesClosedInterval(clone: CloneIdentity): Promise<boolean> {
    const reading = await this.consentSource.readClone(clone);
    const token = reading.kind === "value" ? tokenOfKey(reading.value) : null;
    return token !== null && this.consents.hasClosed(clone, token);
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
      const [first, ...others] = this.remembered.ownersOf(dir);
      return first === undefined
        ? { skipped: "never-seen-alive" }
        : { owners: [first, ...others], current: null };
    }
    if (located.status === "outside-repository") return { skipped: "outside-repo" };
    // A directory git or the file system would not answer for may be a clone: not known to be
    // outside any.
    if (located.status === "unreadable") return { skipped: "unreadable-consent" };
    // A repository with no origin and no commit has nothing to be named by.
    const id = repositoryIdOf(located);
    if (id === null) return { skipped: "outside-repo" };
    // A clone the platform cannot identify cannot be told from another: fail closed.
    if (located.clone === null) return { skipped: "unreadable-consent" };
    const { seen: current, remembered } = this.remembered.remember({
      dir,
      repositoryId: id,
      root: located.root,
      clone: located.clone,
      at: this.environment.now().toISOString(),
    });
    this.remembered = remembered;
    const others = this.remembered
      .ownersOf(dir)
      .filter((owner) => !sameClone(owner.clone, current.clone));
    return { owners: [current, ...others], current };
  }
}
