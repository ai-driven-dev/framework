import { FileHash } from "./file-hash.js";
import type { MergeStrategy } from "./merge.js";

export class InstallationFile {
  /** A file whose hash is that of `content`. */
  static hashing(relativePath: string, content: string, mergeStrategy?: MergeStrategy) {
    return new InstallationFile({
      relativePath,
      content,
      hash: FileHash.of(content),
      mergeStrategy,
    });
  }

  readonly relativePath: string;
  readonly content: string;
  readonly hash: FileHash;
  readonly mergeStrategy: MergeStrategy;
  readonly frameworkPath?: string;

  constructor(params: {
    relativePath: string;
    content: string;
    hash: FileHash;
    mergeStrategy?: MergeStrategy;
    frameworkPath?: string;
  }) {
    this.relativePath = params.relativePath;
    this.content = params.content;
    this.hash = params.hash;
    this.mergeStrategy = params.mergeStrategy ?? "none";
    this.frameworkPath = params.frameworkPath;
  }
}
