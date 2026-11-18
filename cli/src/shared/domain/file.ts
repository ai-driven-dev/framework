import { createHash } from "node:crypto";
import { ManifestValidationError } from "./errors.js";
import type { MergeStrategy } from "./merge.js";

/** A bundled config asset, as the asset provider hands it over. */
export type ConfigAsset = Record<string, unknown> | readonly unknown[] | string;

/** The bundled schemas a build validates against. */
export type SchemaName =
  | "plugin-manifest"
  | "marketplace"
  | "claude-marketplace"
  | "codex-marketplace"
  | "codex-plugin-manifest";

// Shared vocabulary because `removeRedundantGitkeeps` below reasons about it independently
// of any context's directory conventions.
export const GITKEEP_FILE = ".gitkeep";

const MD5_PATTERN = /^[0-9a-f]{32}$/;

export class FileHash {
  readonly value: string;

  /** The md5 of `content`, the hash every recorded content digest is compared against. */
  static of(content: string): FileHash {
    return new FileHash(createHash("md5").update(content).digest("hex"));
  }

  /** Whether `value` is shaped like an md5 digest, without building one. */
  static isDigest(value: string): boolean {
    return MD5_PATTERN.test(value);
  }

  constructor(value: string) {
    if (!FileHash.isDigest(value)) {
      throw new ManifestValidationError(
        `Invalid MD5 hash: "${value}". Expected 32 lowercase hex characters.`
      );
    }
    this.value = value;
  }

  equals(other: FileHash): boolean {
    return this.value === other.value;
  }
}

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

export function removeRedundantGitkeeps(files: InstallationFile[]): InstallationFile[] {
  const nonEmptyDirs = new Set(
    files
      .filter((f) => !f.relativePath.endsWith(`/${GITKEEP_FILE}`))
      .map((f) => f.relativePath.split("/").slice(0, -1).join("/"))
  );
  return files.filter((f) => {
    if (!f.relativePath.endsWith(`/${GITKEEP_FILE}`)) return true;
    const dir = f.relativePath.split("/").slice(0, -1).join("/");
    return !nonEmptyDirs.has(dir);
  });
}
