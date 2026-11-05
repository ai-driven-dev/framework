import { tryParseJson } from "../../../kernel/reading/json-file.js";
import { asPlainObject } from "../../../kernel/reading/plain-object.js";
import {
  type CloneIdentity,
  cloneKey,
  parseCloneIdentity,
  sameClone,
} from "./consent/clone-identity.js";
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
  /** Before a detected change, the origin of a call cannot be established. */
  readonly repository_uncertain_before?: string | null;
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
  return (
    a !== undefined &&
    a.repository_id === b.repository_id &&
    a.root === b.root &&
    a.repository_uncertain_before === b.repository_uncertain_before
  );
}

/** Remember a detected repository change across all directories in the same clone. */
export function rememberResolution(
  resolutions: Map<string, RepositoryResolution>,
  found: Omit<RepositoryResolution, "seen_at" | "repository_uncertain_before">,
  at: string
): { readonly resolution: RepositoryResolution; readonly changed: boolean } {
  const key = resolutionKey(found.dir, found.clone);
  const previous = resolutions.get(key);
  const related = [...resolutions.entries()].filter(([, value]) =>
    sameClone(value.clone, found.clone)
  );
  const changedRepository = related.some(
    ([, value]) => value.repository_id !== found.repository_id
  );
  const boundaries = related.flatMap(([, value]) =>
    value.repository_uncertain_before ? [value.repository_uncertain_before] : []
  );
  if (changedRepository) boundaries.push(at);
  const uncertainBefore = related.some(([, value]) => value.repository_uncertain_before === null)
    ? null
    : boundaries.sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1);
  let changed = false;
  if (changedRepository) {
    for (const [otherKey, value] of related) {
      const replacement = {
        ...value,
        repository_id: found.repository_id,
        repository_uncertain_before: uncertainBefore,
      };
      if (!sameResolution(value, replacement)) {
        resolutions.set(otherKey, replacement);
        changed = true;
      }
    }
  }
  const resolution: RepositoryResolution = {
    ...found,
    // A root observed during opt-in establishes the first observation for its clone,
    // including working directories first visited later.
    seen_at:
      previous?.seen_at ??
      related.map(([, value]) => value.seen_at).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ??
      at,
    ...(uncertainBefore !== undefined ? { repository_uncertain_before: uncertainBefore } : {}),
  };
  if (!sameResolution(resolutions.get(key), resolution)) {
    resolutions.set(key, resolution);
    changed = true;
  }
  return { resolution, changed };
}

export function repositoryUncertain(resolution: RepositoryResolution, at: string): boolean {
  return (
    Date.parse(at) < Date.parse(resolution.seen_at) ||
    resolution.repository_uncertain_before === null ||
    (resolution.repository_uncertain_before !== undefined &&
      Date.parse(at) <= Date.parse(resolution.repository_uncertain_before))
  );
}

/** The instant from which a clone answered for a directory: its birth, else the time ingest
 * first saw it there. */
function answeringFrom(resolution: RepositoryResolution): number {
  return resolution.clone.birthtimeMs > 0
    ? resolution.clone.birthtimeMs
    : Date.parse(resolution.seen_at);
}

/** The clones that may answer for a call made at `at` in a directory several clones have lived in:
 * those latest to have started by then. A call older than all of them goes to the earliest, because
 * a clone with no birth time is known only from the day ingest first saw a directory in it, and
 * a call made before that day in a directory of its own is still its call. That is no consent
 * on its own: the owner's interval must cover the call, and none opens before the clone's `on`. */
export function ownersAt(
  owners: readonly [RepositoryResolution, ...RepositoryResolution[]],
  at: number
): readonly RepositoryResolution[] {
  const eligible = owners.filter((owner) => answeringFrom(owner) <= at);
  const candidates = eligible.length ? eligible : owners;
  const times = candidates.map(answeringFrom);
  const selected = eligible.length ? Math.max(...times) : Math.min(...times);
  return candidates.filter((owner) => answeringFrom(owner) === selected);
}

function resolutionKeyOf(resolution: RepositoryResolution): string {
  return resolutionKey(resolution.dir, resolution.clone);
}

function parseResolution(value: unknown): RepositoryResolution | null {
  const object = asPlainObject(value);
  if (object === null) return null;
  const clone = parseCloneIdentity(object.clone);
  if (clone === null) return null;
  const {
    dir,
    repository_id: repositoryId,
    root,
    seen_at: seenAt,
    repository_uncertain_before: uncertainBefore,
  } = object;
  if (typeof dir !== "string" || dir === "") return null;
  if (typeof repositoryId !== "string" || repositoryId === "") return null;
  if (typeof root !== "string") return null;
  if (typeof seenAt !== "string" || Number.isNaN(Date.parse(seenAt))) return null;
  const uncertainty =
    uncertainBefore === undefined
      ? undefined
      : typeof uncertainBefore === "string" && !Number.isNaN(Date.parse(uncertainBefore))
        ? uncertainBefore
        : null;
  return {
    dir,
    repository_id: repositoryId,
    root,
    clone,
    seen_at: seenAt,
    ...(uncertainty !== undefined ? { repository_uncertain_before: uncertainty } : {}),
  };
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
