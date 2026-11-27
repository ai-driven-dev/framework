import type { NotStoredReason } from "../../contract/repository-resolution.js";
import { type CloneIdentity, cloneKey, sameClone } from "../consent/clone-identity.js";
import type { ConsentLog } from "../consent/consent-log.js";
import type { RememberedResolutions } from "../remembered-resolutions.js";
import { repositoryIdOf } from "../repository-identity.js";
import { cwdKey, ownerAt, type RepositoryResolution } from "../repository-resolution.js";
import type { LocatedDirectory } from "./located-directory.js";

export type DirectoryOutcome =
  | {
      readonly stored: RepositoryResolution;
      /** Resolved from the directory as it stands, not from what was remembered of it. */
      readonly live: boolean;
      readonly mayConsent?: never;
    }
  | {
      readonly skipped: Exclude<NotStoredReason, "unreadable-consent">;
      readonly mayConsent?: never;
    }
  | {
      readonly skipped: "unreadable-consent";
      /** A clone remembered at the directory consented at the call's time: what the directory
       * could still turn out to be once it can be read. Never true while the consent log
       * cannot be trusted. */
      readonly mayConsent: boolean;
    };

export type Directory =
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
  /** macOS and Windows file systems answer one directory to several spellings. */
  readonly caseInsensitiveFileSystem: boolean;
}

/** A verdict no read can give yet. Whether a clone remembered at `cwd` consented at `at`
 * says what the directory could still turn out to be: never true for a directory no read saw
 * readable, nor while the consent log cannot be trusted. */
export function unreadableAt(state: ResolutionState, cwd: string, at: string): DirectoryOutcome {
  const owners = state.remembered.ownersOf(cwdKey(cwd, state.caseInsensitiveFileSystem));
  const mayConsent =
    !state.consents.damaged &&
    owners.some((owner) => state.consents.covers(owner.clone, Date.parse(at)));
  return { skipped: "unreadable-consent", mayConsent };
}

/** What a directory is, once looked at, and what is remembered of it after. `at` gives the
 * moment, and is asked only for a directory that is remembered. */
export function directoryFrom(
  located: LocatedDirectory,
  seen: { readonly dir: string; readonly at: () => string },
  remembered: RememberedResolutions
): { readonly directory: Directory; readonly remembered: RememberedResolutions } {
  const { dir } = seen;
  if (located.status === "gone") {
    const [first, ...others] = remembered.ownersOf(dir);
    const directory: Directory =
      first === undefined
        ? { skipped: "never-seen-alive" }
        : { owners: [first, ...others], current: null };
    return { directory, remembered };
  }
  if (located.status === "outside-repository") {
    return { directory: { skipped: "outside-repo" }, remembered };
  }
  // A directory git or the file system would not answer for may be a clone: not known to be
  // outside any.
  if (located.status === "unreadable") {
    return { directory: { skipped: "unreadable-consent" }, remembered };
  }
  // A repository with no origin and no commit has nothing to be named by.
  const id = repositoryIdOf(located);
  if (id === null) return { directory: { skipped: "outside-repo" }, remembered };
  // A clone the platform cannot identify cannot be told from another: fail closed.
  if (located.clone === null) {
    return { directory: { skipped: "unreadable-consent" }, remembered };
  }
  const { seen: current, remembered: learned } = remembered.remember({
    dir,
    repositoryId: id,
    root: located.root,
    clone: located.clone,
    at: seen.at(),
  });
  // `learned` holds `current` too: a twin owner answers as the same clone.
  return {
    directory: { owners: [current, ...learned.ownersOf(dir)], current },
    remembered: learned,
  };
}

/** A call made in `cwd` at `at`. `closed` says whether the clone's own key, as it stands, names
 * an interval of it that was closed: it opted in once, so the person is told to run `on` again,
 * not that it never did. */
export interface Call {
  readonly cwd: string;
  readonly at: string;
  readonly closed: (clone: CloneIdentity) => Promise<boolean>;
}

/** The verdict on a call, given what its directory is. */
export async function verdictOn(
  directory: Directory,
  call: Call,
  state: ResolutionState
): Promise<DirectoryOutcome> {
  if (!("skipped" in directory)) return judgeOwner(directory, call, state);
  return directory.skipped === "unreadable-consent"
    ? unreadableAt(state, call.cwd, call.at)
    : { skipped: directory.skipped };
}

async function judgeOwner(
  directory: Exclude<Directory, { skipped: NotStoredReason }>,
  call: Call,
  state: ResolutionState
): Promise<DirectoryOutcome> {
  const instant = Date.parse(call.at);
  const owner = ownerAt(directory.owners, instant);
  if (state.unreadable.has(cloneKey(owner.clone))) return unreadableAt(state, call.cwd, call.at);
  const live = directory.current !== null && sameClone(directory.current.clone, owner.clone);
  if (state.consents.covers(owner.clone, instant)) return { stored: owner, live };
  return { skipped: live && (await call.closed(owner.clone)) ? "consent-closed" : "no-consent" };
}
