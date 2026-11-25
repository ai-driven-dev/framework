import { whenAbsent } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";

export class ResolveReferenceRoot {
  constructor(private readonly fs: FileReader) {}

  /**
   * Resolves `projectRoot` through every symlink, the same real location `clean` insists on before
   * deleting a user-scope file: a reference recorded under a syntactic path a symlink later moved
   * would never match what a later `clean` resolves for the same project. Falls back to the path as
   * given only on `ENOENT`, so `clean` can still drop a reference to a project since removed.
   */
  async execute(projectRoot: string): Promise<string> {
    return whenAbsent(() => this.fs.realpath(projectRoot), projectRoot);
  }
}
