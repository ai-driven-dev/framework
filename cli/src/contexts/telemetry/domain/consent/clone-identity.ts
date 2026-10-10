import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

/** A clone, told from every other by its git common dir: where it is, and which directory it
 * really is. The path alone is not enough, because a clone can be deleted and another made at
 * the same path, and neither is the platform's inode alone, which a file system may hand to the
 * next directory it creates.
 *
 * What `fs.stat` reports for a directory, per platform (Node's own documentation of `Stats`,
 * and libuv's `uv_fs_stat`; only macOS was observed here):
 * - macOS (APFS, HFS+): `dev` is the volume, `ino` the inode, `birthtimeMs` the creation time.
 * - Linux: `ino` is the inode. `birthtimeMs` comes from `statx` where the kernel and the file
 *   system keep it (ext4, btrfs, xfs), else it is `0`, or, through libuv's `stat` fallback, the
 *   inode's change time, which moves whenever an entry is added to the directory and so is not a
 *   birth at all. A birth equal to the change time is therefore taken as no birth: `0`.
 * - Windows (NTFS): `ino` is the 64-bit file index, which a JavaScript number cannot hold
 *   exactly, so the stat is asked in `bigint` and the index kept as text. `birthtimeMs` is the
 *   creation time. A file system with no file index (FAT, some network shares) reports `0`.
 *
 * Where `birthtimeMs` is `0`, `dev`, `ino` and the path are the identity, and a clone that takes
 * the inode and the path of a deleted one is taken for it: a residual limit, in the usage
 * contract. Where `ino` is `0` there is no identity, and nothing is stored for the clone. */
export interface CloneIdentity {
  /** The real path of the git common dir. */
  readonly path: string;
  readonly dev: string;
  readonly ino: string;
  /** Milliseconds since the epoch; `0` when the platform has none. */
  readonly birthtimeMs: number;
}

/** The facts of `fs.stat(path, { bigint: true })` an identity is made of. */
export interface StatFacts {
  readonly dev: bigint;
  readonly ino: bigint;
  readonly birthtimeMs: bigint;
  readonly ctimeMs: bigint;
}

/** The identity of the directory at `path`, `null` when the platform gives it none. */
export function identityFromStat(path: string, stat: StatFacts): CloneIdentity | null {
  if (stat.ino === 0n) return null;
  const born = stat.birthtimeMs <= 0n || stat.birthtimeMs === stat.ctimeMs ? 0n : stat.birthtimeMs;
  return { path, dev: String(stat.dev), ino: String(stat.ino), birthtimeMs: Number(born) };
}

/** Whether two looks found the same clone: every part of the identity is the same. */
export function sameClone(a: CloneIdentity, b: CloneIdentity): boolean {
  return a.path === b.path && a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
}

/** A clone as a map key: two identities have one key exactly when they are the same clone. */
export function cloneKey(clone: CloneIdentity): string {
  return `${clone.dev}:${clone.ino}:${clone.birthtimeMs}:${clone.path}`;
}

export function parseCloneIdentity(value: unknown): CloneIdentity | null {
  const object = asPlainObject(value);
  if (object === null) return null;
  const { path, dev, ino, birthtimeMs } = object;
  if (typeof path !== "string" || path === "") return null;
  if (typeof dev !== "string" || dev === "") return null;
  if (typeof ino !== "string" || ino === "" || ino === "0") return null;
  if (typeof birthtimeMs !== "number" || !Number.isFinite(birthtimeMs) || birthtimeMs < 0) {
    return null;
  }
  return { path, dev, ino, birthtimeMs };
}
