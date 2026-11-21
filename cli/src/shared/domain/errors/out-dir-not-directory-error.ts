import { AiddError } from "./aidd-error.js";

export class OutDirNotDirectoryError extends AiddError {
  readonly code = "out-dir-not-directory";
  constructor(outDir: string) {
    super(`Refusing to build: --out '${outDir}' does not exist or is not a directory.`);
    this.name = "OutDirNotDirectoryError";
  }
}
