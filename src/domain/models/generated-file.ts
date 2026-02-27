import type { FileHash } from "./file-hash.js";

export class GeneratedFile {
  readonly relativePath: string;
  readonly content: string;
  readonly hash: FileHash;

  constructor(params: {
    relativePath: string;
    content: string;
    hash: FileHash;
  }) {
    this.relativePath = params.relativePath;
    this.content = params.content;
    this.hash = params.hash;
  }
}
