import type { FileHash } from "./file-hash.js";

export class GeneratedFile {
  readonly relativePath: string;
  readonly content: string;
  readonly hash: FileHash;
  readonly merge: boolean;

  constructor(params: {
    relativePath: string;
    content: string;
    hash: FileHash;
    merge?: boolean;
  }) {
    this.relativePath = params.relativePath;
    this.content = params.content;
    this.hash = params.hash;
    this.merge = params.merge ?? false;
  }
}
