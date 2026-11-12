import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { samePath } from "../../../../kernel/paths.js";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";

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
  let candidate = lexicalPath;
  while (true) {
    try {
      const canonical = await fs.realpath(candidate);
      if (!within(canonicalRoot, canonical)) {
        throw new Error(
          `'${path}' resolves outside project root '${projectRoot}'; local mutation refused.`
        );
      }
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // A dangling symlink exists even though realpath cannot resolve it. Never treat it
      // as an absent path whose parent is safe to write through.
      if (await fs.entryExists?.(candidate))
        throw new Error(`'${candidate}' is an unresolved symlink; local mutation refused.`);
      if (candidate === lexicalRoot) {
        throw new Error(`Project root '${projectRoot}' disappeared; local mutation refused.`);
      }
      candidate = dirname(candidate);
    }
  }
}

/** A tracked file or disposable cache is not owned if any component became a symlink. */
export async function assertNoSymlinksWithinRoot(
  fs: FileReader,
  root: string,
  path: string
): Promise<void> {
  const lexicalRoot = resolve(root);
  const lexicalPath = resolve(path);
  if (!strictlyWithin(lexicalRoot, lexicalPath))
    throw new Error(`'${path}' escapes its owned root '${root}'.`);
  let canonical = await fs.realpath(lexicalRoot);
  let candidate = lexicalRoot;
  for (const segment of relative(lexicalRoot, lexicalPath).split(sep)) {
    candidate = join(candidate, segment);
    canonical = join(canonical, segment);
    try {
      if (!samePath(await fs.realpath(candidate), canonical))
        throw new Error(`'${candidate}' is a symlink; refusing to mutate it.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      if (!fs.entryExists || (await fs.entryExists(candidate)))
        throw new Error(
          `'${candidate}' cannot be verified without following an unresolved symlink.`
        );
      return;
    }
  }
}

function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function strictlyWithin(root: string, path: string): boolean {
  return root !== path && within(root, path);
}
