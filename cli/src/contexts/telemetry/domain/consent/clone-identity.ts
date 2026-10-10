import { asPlainObject } from "../../../../kernel/reading/plain-object.js";

/** A clone, told from every other by its git common dir: where it is, and which directory it
 * really is. The path alone is not enough, because a clone can be deleted and another made at
 * the same path, and neither is the platform's inode alone, which a file system may hand to the
 * next directory it creates.
 *
 * What `fs.stat` reports for a directory, per platform. macOS was observed. Linux and Windows
 * are read from Node's `fs.Stats` documentation (`birthtime`) and from libuv's `src/unix/fs.c`,
 * `src/unix/linux.c` and `src/win/fs.c` (v1.x), and were not run:
 * - macOS (APFS, HFS+): `dev` is the volume, `ino` the inode, `birthtimeMs` the creation time.
 * - Linux: `ino` is the inode. libuv asks `statx` and copies `stx_btime` as the birth time
 *   without looking at `stx_mask`, so a file system that keeps none leaves it as the kernel
 *   gives it, `0` in practice. When `statx` is refused (a seccomp filter, an old kernel) libuv
 *   falls back to `stat` and sets the birth time to the change time, which moves whenever an
 *   entry is added to the directory and so is not a birth at all. Node's documentation says as
 *   much: `birthtime` "may instead hold either the `ctime` or `1970-01-01T00:00Z`". A birth equal
 *   to the change time to the nanosecond is therefore taken as no birth: `0`. The comparison is
 *   in nanoseconds because a real birth and the change time often fall in one millisecond: on
 *   ext4, 1 git common dir in 80 freshly cloned or copied had both in the same millisecond, and
 *   none had them equal to the nanosecond, so a millisecond comparison would drop a real birth.
 * - Windows (NTFS): `dev` is the volume serial number, `ino` the 64-bit file index
 *   (`IndexNumber`), which a JavaScript number cannot hold exactly, so the stat is asked in
 *   `bigint` and the index kept as text. `birthtimeMs` is the creation time.
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
  readonly birthtimeNs: bigint;
  readonly ctimeNs: bigint;
}

/** The identity of the directory at `path`, `null` when the platform gives it none. */
export function identityFromStat(path: string, stat: StatFacts): CloneIdentity | null {
  if (stat.ino === 0n) return null;
  const born = stat.birthtimeMs <= 0n || stat.birthtimeNs === stat.ctimeNs ? 0n : stat.birthtimeMs;
  return { path, dev: String(stat.dev), ino: String(stat.ino), birthtimeMs: Number(born) };
}

/** A clone as a map key: two identities have one key exactly when they are the same clone. */
export function cloneKey(clone: CloneIdentity): string {
  return `${clone.dev}:${clone.ino}:${clone.birthtimeMs}:${clone.path}`;
}

/** Whether two looks found the same clone: every part of the identity is the same. */
export function sameClone(a: CloneIdentity, b: CloneIdentity): boolean {
  return cloneKey(a) === cloneKey(b);
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
