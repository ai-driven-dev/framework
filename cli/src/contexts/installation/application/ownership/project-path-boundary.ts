import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";

/** Resolve an existing file or its nearest existing parent before mutating project-local content. */
export async function assertProjectPathWithinRoot(
  fs: FileReader,
  projectRoot: string,
  path: string
): Promise<void> {
  const lexicalRoot = resolve(projectRoot);
  const lexicalPath = resolve(path);
  if (!strictlyWithin(lexicalRoot, lexicalPath)) {
    throw new Error(`'${path}' escapes project root '${projectRoot}'; local mutation refused.`);
  }
  const canonicalRoot = await fs.realpath(lexicalRoot);
  const canonical = await realpathOfNearest(fs, lexicalPath, lexicalRoot);
  if (canonical === null) {
    throw new Error(`Project root '${projectRoot}' disappeared; local mutation refused.`);
  }
  if (!within(canonicalRoot, canonical)) {
    throw new Error(
      `'${path}' resolves outside project root '${projectRoot}'; local mutation refused.`
    );
  }
}

/** The real path of `candidate`, or of its nearest existing parent; null once `root` itself is gone. */
async function realpathOfNearest(
  fs: FileReader,
  candidate: string,
  root: string
): Promise<string | null> {
  const resolved = await whenAbsent(() => fs.realpath(candidate), null);
  if (resolved !== null) return resolved;
  if (candidate === root) return null;
  return realpathOfNearest(fs, dirname(candidate), root);
}

function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function strictlyWithin(root: string, path: string): boolean {
  return root !== path && within(root, path);
}
