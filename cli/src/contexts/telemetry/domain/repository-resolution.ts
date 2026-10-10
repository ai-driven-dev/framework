import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import { type CloneIdentity, cloneKey, parseCloneIdentity } from "./consent/clone-identity.js";
import { compareText } from "./text-order.js";

/** What a working directory was found to be, the first time it was seen alive in a clone. A
 * directory has one for each clone that has lived there: a clone deleted and made again at the
 * same path leaves two. */
export interface RepositoryResolution {
  /** The directory, as `cwdKey` spells it. */
  readonly dir: string;
  readonly repository_id: string;
  /** The repository's working-tree root. */
  readonly root: string;
  /** The clone the directory belonged to. */
  readonly clone: CloneIdentity;
  /** When ingest first saw the directory in this clone. */
  readonly seen_at: string;
}

/** The key a directory is remembered under. File systems that ignore case (macOS, Windows)
 * answer the same directory to two spellings, so the key folds them into one. */
export function cwdKey(cwd: string, caseInsensitive: boolean): string {
  return caseInsensitive ? cwd.toLowerCase() : cwd;
}

/** A directory in one clone. */
export function resolutionKey(dir: string, clone: CloneIdentity): string {
  return `${dir}\u0000${cloneKey(clone)}`;
}

/** Whether two looks at a directory in the same clone found the same thing. */
export function sameResolution(
  a: RepositoryResolution | undefined,
  b: RepositoryResolution
): boolean {
  return a !== undefined && a.repository_id === b.repository_id && a.root === b.root;
}

/** The instant from which a clone answered for a directory: its birth, else the time ingest
 * first saw it there. */
function answeringFrom(resolution: RepositoryResolution): number {
  return resolution.clone.birthtimeMs > 0
    ? resolution.clone.birthtimeMs
    : Date.parse(resolution.seen_at);
}

/** The clone that answers for a call made at `at` in a directory several clones have lived in:
 * the latest to have started by then. A call older than all of them goes to the first, because
 * a clone with no birth time is known only from the day ingest first saw a directory in it, and
 * a call made before that day in a directory of its own is still its call. That is no consent
 * on its own: the owner's interval must cover the call, and none opens before the clone's `on`. */
export function ownerAt(
  owners: readonly [RepositoryResolution, ...RepositoryResolution[]],
  at: number
): RepositoryResolution {
  const [first, ...later] = [...owners].sort(
    (a, b) =>
      answeringFrom(a) - answeringFrom(b) || compareText(resolutionKeyOf(a), resolutionKeyOf(b))
  );
  let owner = first as RepositoryResolution;
  for (const candidate of later) if (answeringFrom(candidate) <= at) owner = candidate;
  return owner;
}

function resolutionKeyOf(resolution: RepositoryResolution): string {
  return resolutionKey(resolution.dir, resolution.clone);
}

function parseResolution(value: unknown): RepositoryResolution | null {
  const object = asPlainObject(value);
  if (object === null) return null;
  const clone = parseCloneIdentity(object.clone);
  if (clone === null) return null;
  const { dir, repository_id: repositoryId, root, seen_at: seenAt } = object;
  if (typeof dir !== "string" || dir === "") return null;
  if (typeof repositoryId !== "string" || repositoryId === "") return null;
  if (typeof root !== "string") return null;
  if (typeof seenAt !== "string" || Number.isNaN(Date.parse(seenAt))) return null;
  return { dir, repository_id: repositoryId, root, clone, seen_at: seenAt };
}

/** The format of `roots.json`. A file of another format, among them every file written before
 * a directory was remembered together with its clone's identity, holds nothing: a directory
 * seen alive is simply remembered again, and one that is gone is counted. */
const FORMAT = 2;

/** A file that is missing or unreadable is no resolutions. */
export function parseResolutions(text: string | null): Map<string, RepositoryResolution> {
  const resolutions = new Map<string, RepositoryResolution>();
  const parsed = tryParseJson(text ?? "");
  const object = parsed.ok ? asPlainObject(parsed.value) : null;
  if (object === null || object.version !== FORMAT || !Array.isArray(object.directories)) {
    return resolutions;
  }
  for (const value of object.directories) {
    const resolution = parseResolution(value);
    if (resolution !== null) resolutions.set(resolutionKeyOf(resolution), resolution);
  }
  return resolutions;
}

export function renderResolutions(resolutions: ReadonlyMap<string, RepositoryResolution>): string {
  const sorted = [...resolutions.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([, resolution]) => resolution);
  return `${JSON.stringify({ version: FORMAT, directories: sorted }, null, 2)}\n`;
}

/** Why a billed call was read and not stored. `consent-closed`: the clone's live key names an
 * interval that was closed, so it did opt in once and can again; `no-consent` is a clone that
 * never did. */
export type NotStoredReason =
  | "outside-repo"
  | "never-seen-alive"
  | "no-consent"
  | "consent-closed"
  | "unreadable-consent"
  | "no-cwd"
  | "undated";
