import { dirname, join } from "node:path";
import { USER_SOURCE_REFERENCES_FILENAME } from "../../../shared/domain/layout/aidd-layout.js";
import { dedupePathSegments, samePathSegment } from "../../../shared/domain/paths.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import { UnreadableUserSourceReferencesError } from "../../../shared/domain/shared.error.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../shared/ports/file-writer.js";
import type { UserSourceReferences } from "../ports/user-source-references.js";

type ReferencesFile = Record<string, readonly string[]>;

/** The version key `projectRoot` is recorded under, and that key's full roots list: `undefined`
 * when it is recorded nowhere. Path equality goes through `samePathSegment`, never `===`, so a
 * case-insensitive platform still matches a root a real `realpath` returns with different casing. */
function findVersionFor(
  references: ReferencesFile,
  projectRoot: string,
  platform: string
): [string, readonly string[]] | undefined {
  for (const [version, roots] of Object.entries(references)) {
    if (roots.some((root) => samePathSegment(root, projectRoot, platform))) return [version, roots];
  }
  return undefined;
}

/** A project root recorded under one version, its paths compared by the platform's rules. */
interface RootRecord {
  readonly version: string;
  readonly projectRoot: string;
  readonly platform: string;
}

function isRecordedOnlyAt(
  references: ReferencesFile,
  { version, projectRoot, platform }: RootRecord
): boolean {
  const holdsRoot = (roots: readonly string[]) =>
    roots.some((root) => samePathSegment(root, projectRoot, platform));
  return (
    holdsRoot(references[version] ?? []) &&
    Object.entries(references).every(([key, roots]) => key === version || !holdsRoot(roots))
  );
}

/** The references with `projectRoot` recorded under `version` alone, and every other version
 * keeping only the roots it still has. */
function recordedAt(
  references: ReferencesFile,
  { version, projectRoot, platform }: RootRecord
): ReferencesFile {
  const withoutRoot = (roots: readonly string[]) =>
    roots.filter((root) => !samePathSegment(root, projectRoot, platform));
  const next: Record<string, string[]> = {};
  for (const [key, roots] of Object.entries(references)) {
    const remaining = withoutRoot(roots);
    if (key !== version && remaining.length > 0) next[key] = remaining;
  }
  next[version] = [...withoutRoot(references[version] ?? []), projectRoot];
  return next;
}

export class UserSourceReferencesAdapter implements UserSourceReferences {
  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly userConfigDir: () => string,
    private readonly platform: string = process.platform
  ) {}

  async addReference(version: string, projectRoot: string): Promise<void> {
    const references = await this.readAll();
    const record = { version, projectRoot, platform: this.platform };
    if (isRecordedOnlyAt(references, record)) return;
    const next = recordedAt(references, record);
    // `projectRoot` is protected from the prune below: a project vanishing between being recorded
    // and this very write finishing would otherwise drop the claim `addReference` was just asked
    // to add.
    await this.write(next, projectRoot);
  }

  async removeReference(projectRoot: string): Promise<void> {
    const references = await this.readAll();
    const found = findVersionFor(references, projectRoot, this.platform);
    if (found === undefined) return;
    const [version, roots] = found;
    const remaining = roots.filter((root) => !samePathSegment(root, projectRoot, this.platform));
    const next = { ...references };
    if (remaining.length > 0) next[version] = remaining;
    else delete next[version];
    await this.write(next);
  }

  async listAllReferencingProjects(): Promise<readonly string[]> {
    const references = await this.readAll();
    const allRoots: string[] = [];
    for (const roots of Object.values(references)) allRoots.push(...roots);
    const deduped = dedupePathSegments(allRoots, this.platform);
    const existing: string[] = [];
    for (const root of deduped) {
      if (await this.fs.fileExists(root)) existing.push(root);
    }
    return existing;
  }

  private get path(): string {
    return join(this.userConfigDir(), USER_SOURCE_REFERENCES_FILENAME);
  }

  private async readAll(): Promise<ReferencesFile> {
    const path = this.path;
    if (!(await this.fs.fileExists(path))) return {};
    const raw = await this.fs.readFile(path);
    return parseReferencesFile(raw, path);
  }

  /** Every write is the one place a `projectRoot` that has stopped existing is purged from the file
   * entirely, not merely ignored at read time: until this the file only ever grew, and every read
   * kept `stat`-ing dead paths. `protectedRoot` is never pruned regardless of its own existence, so
   * a write can never drop the very claim it exists to record. */
  private async write(references: ReferencesFile, protectedRoot?: string): Promise<void> {
    const pruned = await this.pruneVanishedRoots(references, protectedRoot);
    await this.fs.createDirectory(dirname(this.path));
    await this.fs.writeFile(this.path, JSON.stringify(pruned, null, 2));
  }

  private async survivingRoots(
    roots: readonly string[],
    protectedRoot: string | undefined
  ): Promise<string[]> {
    const existing: string[] = [];
    for (const root of roots) {
      const protectedFromPrune =
        protectedRoot !== undefined && samePathSegment(root, protectedRoot, this.platform);
      if (protectedFromPrune || (await this.fs.fileExists(root))) existing.push(root);
    }
    return existing;
  }

  private async pruneVanishedRoots(
    references: ReferencesFile,
    protectedRoot: string | undefined
  ): Promise<ReferencesFile> {
    const result: ReferencesFile = {};
    for (const [version, roots] of Object.entries(references)) {
      const existing = await this.survivingRoots(roots, protectedRoot);
      if (existing.length > 0) result[version] = existing;
    }
    return result;
  }
}

/** Validates the file's shape into a typed value at the adapter boundary. A version key whose value
 * is not a list of strings is exactly as unreadable as JSON that fails to parse at all:
 * half-trusting a corrupted shape is how a later write would silently drop what it could not
 * validate. */
function parseReferencesFile(raw: string, path: string): ReferencesFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new UnreadableUserSourceReferencesError(
      path,
      error instanceof Error ? error.message : "it is not valid JSON"
    );
  }
  const versions = asPlainObject(parsed);
  if (versions === null) {
    throw new UnreadableUserSourceReferencesError(path, "it is not a version-keyed object");
  }
  const result: Record<string, string[]> = {};
  for (const [version, projectRoots] of Object.entries(versions)) {
    if (!Array.isArray(projectRoots) || !projectRoots.every((root) => typeof root === "string")) {
      throw new UnreadableUserSourceReferencesError(
        path,
        `its "${version}" entry is not a list of project paths`
      );
    }
    result[version] = projectRoots;
  }
  return result;
}
