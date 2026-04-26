import { ManifestValidationError } from "../errors.js";
import { GITKEEP_FILE } from "./framework.js";
import type { MergeStrategy } from "./merge.js";

// ── FileDiff ─────────────────────────────────────────────────────────────────

export type FileDiffKind = "added" | "removed" | "changed" | "unchanged";

export interface FileDiff {
  relativePath: string;
  kind: FileDiffKind;
  conflict?: boolean;
}

// ── FileHash ──────────────────────────────────────────────────────────────────

const MD5_PATTERN = /^[0-9a-f]{32}$/;

export class FileHash {
  readonly value: string;

  constructor(value: string) {
    if (!MD5_PATTERN.test(value)) {
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

// ── InstallationFile ──────────────────────────────────────────────────────────

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
