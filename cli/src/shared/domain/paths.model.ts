import { isAbsolute, posix, relative, sep, win32 } from "node:path";

/** The path segments of `path` past `base`, `undefined` when `path` does not sit under
 * `base`. Compares spelling, folded by `platform` for the containment test only, so the
 * segments returned keep their original casing, and resolves neither side. A trailing
 * separator on `base` is tolerated. */
export function segmentsUnder(base: string, path: string, platform: string): string[] | undefined {
  const normalizedBase = stripTrailingSeparator(base.replace(/\\/g, "/"));
  const normalizedPath = stripTrailingSeparator(path.replace(/\\/g, "/"));
  const compareBase = foldCase(normalizedBase, platform);
  const comparePath = foldCase(normalizedPath, platform);
  if (!comparePath.startsWith(`${compareBase}/`)) return undefined;
  const remainder = normalizedPath.slice(normalizedBase.length + 1);
  return remainder.split("/");
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function stripTrailingSeparator(p: string): string {
  return p.endsWith("/") ? p.slice(0, -1) : p;
}

function foldCase(p: string, platform: string): string {
  return platform === "win32" ? p.toLowerCase() : p;
}

/** Whether two path segments name the same thing, folded the way a case-insensitive
 * filesystem would: identical spelling everywhere but win32, where the comparison ignores
 * case. `platform` is always a parameter, so a test can exercise the win32 branch on any OS. */
export function samePathSegment(a: string, b: string, platform: string): boolean {
  return platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** `roots` with every `samePathSegment` duplicate collapsed away, the first spelling kept.
 * A plain `Set` compares by exact string equality, so on win32 two entries differing only
 * in case, one directory the filesystem never tells apart, would survive as two. */
export function dedupePathSegments(roots: readonly string[], platform: string): string[] {
  const deduped: string[] = [];
  for (const root of roots) {
    if (!deduped.some((seen) => samePathSegment(seen, root, platform))) deduped.push(root);
  }
  return deduped;
}

// One directory is the other, or contains it, separators normalised, so nesting is
// recognised on Windows too. Both sides are expected already resolved: this compares
// spelling, it does not resolve.
export function pathContainsOrEquals(outer: string, inner: string): boolean {
  const normalizedOuter = outer.replace(/\\/g, "/");
  const normalizedInner = inner.replace(/\\/g, "/");
  return normalizedOuter === normalizedInner || normalizedInner.startsWith(`${normalizedOuter}/`);
}

/** Whether two paths name the same directory: separators normalised, and case folded the way
 * a case-insensitive filesystem would, on win32 only, where a backslash separates and case
 * does not count. Elsewhere a backslash is an ordinary character in a name. Both sides are
 * expected already resolved: this compares spelling, it does not resolve. A `realpath`
 * answer and a path a host stored name the same directory in two spellings on Windows, and
 * `===` calls them different. */
export function samePath(a: string, b: string, platform: string): boolean {
  if (platform !== "win32") return a === b;
  const folded = (p: string): string => p.replace(/\\/g, "/").toLowerCase();
  return folded(a) === folded(b);
}

/** Either direction: neither may sit inside the other. */
export function pathsOverlap(a: string, b: string): boolean {
  return pathContainsOrEquals(a, b) || pathContainsOrEquals(b, a);
}

/**
 * `target` relative to `base`, spelled with forward slashes whatever the platform: the form
 * every path this CLI records for another machine to read takes (a manifest's
 * `files[].relativePath`, a snapshot key, a plugin ref), so a tree written on Windows and
 * read on Linux names the same file.
 */
export function posixRelative(base: string, target: string, platform: string): string {
  const impl = platform === "win32" ? win32 : posix;
  return impl.relative(base, target).split(impl.sep).join("/");
}

/** Whether a candidate path sits inside a boundary directory: both resolved by the caller. */
export type PathContainment = (candidate: string, boundary: string) => boolean;

/**
 * Whether `candidate` sits inside `boundary`, the boundary itself included. Both arguments must
 * be resolved: a comparison of unresolved strings catches neither a `..` segment, which
 * `path.join` erases before the string is built, nor a directory that turned into a symlink.
 */
export const isWithin: PathContainment = (candidate, boundary) => {
  const rel = relative(boundary, candidate);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};

/** Whether `candidate` sits inside `boundary`, never equal to it. */
export const isStrictlyWithin: PathContainment = (candidate, boundary) =>
  relative(boundary, candidate) !== "" && isWithin(candidate, boundary);
