import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
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
      if (candidate === lexicalRoot) {
        throw new Error(`Project root '${projectRoot}' disappeared; local mutation refused.`);
      }
      candidate = dirname(candidate);
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
