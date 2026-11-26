import { dirname, resolve } from "node:path";
import { isStrictlyWithin, isWithin } from "../../../../shared/domain/paths.model.js";
import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";

/** Resolve an existing file or its nearest existing parent before mutating project-local content. */
export class AssertProjectPathWithinRoot {
  constructor(private readonly fs: FileReader) {}

  async execute(projectRoot: string, path: string): Promise<void> {
    const lexicalRoot = resolve(projectRoot);
    const lexicalPath = resolve(path);
    if (!isStrictlyWithin(lexicalPath, lexicalRoot)) {
      throw new Error(`'${path}' escapes project root '${projectRoot}'; local mutation refused.`);
    }
    const canonicalRoot = await this.fs.realpath(lexicalRoot);
    const canonical = await realpathOfNearest(this.fs, lexicalPath, lexicalRoot);
    if (canonical === null) {
      throw new Error(`Project root '${projectRoot}' disappeared; local mutation refused.`);
    }
    if (!isWithin(canonical, canonicalRoot)) {
      throw new Error(
        `'${path}' resolves outside project root '${projectRoot}'; local mutation refused.`
      );
    }
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
