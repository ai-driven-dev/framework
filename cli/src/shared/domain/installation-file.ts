import type { FileHash } from "./file-hash.js";
import type { MergeStrategy } from "./merge.js";

export class InstallationFile {
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
