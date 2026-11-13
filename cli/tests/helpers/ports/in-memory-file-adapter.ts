import { createHash } from "node:crypto";
import { join, posix, resolve } from "node:path";
import type { FileMerger } from "../../../src/contexts/framework/domain/ports/file-merger.js";
import { FileHash } from "../../../src/shared/domain/file.js";
import { type MergeStrategy, mergeIntoJsonFile } from "../../../src/shared/domain/merge.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import type { Hasher } from "../../../src/shared/ports/hasher.js";

export class InMemoryFileAdapter implements FileReader, FileWriter, FileMerger {
  /** No file here has a mode: none is ever executable, and no product code asks. */
  async isExecutable(_path: string): Promise<boolean> {
    return false;
  }

  private readonly files = new Map<string, string>();
  /** Directories that exist: every ancestor of a file, plus what `createDirectory` made.
   * Deleting a file leaves them, as on a real filesystem. */
  private readonly directories = new Set<string>();
  private readonly hasher: Hasher;
  /** Path → what it resolves to, for a test proving `realpath`-based containment
   * without a real filesystem — see `setSymlink`. */
  private readonly symlinks = new Map<string, string>();
  /** Off by default: see `rejectMissingRealpath`. */
  private missingRealpathRejects = false;

  constructor(seed: Record<string, string> = {}, hasher?: Hasher) {
    this.hasher = hasher ?? new DefaultHasher();
    for (const [path, content] of Object.entries(seed)) {
      this.setFile(path, content);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.setFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(norm(path));
  }

  async createDirectory(path: string): Promise<void> {
    const key = dirKey(path);
    this.directories.add(key);
    this.registerAncestors(key);
  }

  /** Climbs from `path` while the directory is known and holds nothing, as the real adapter. */
  async deleteEmptyDirectories(path: string): Promise<void> {
    let current = dirKey(path);
    while (this.directories.has(current) && !this.holdsAnything(current)) {
      this.directories.delete(current);
      const parent = posix.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  async readFile(path: string): Promise<string> {
    const normalizedPath = norm(path);
    const content = this.files.get(normalizedPath);
    if (content === undefined) {
      throw enoent("open", normalizedPath);
    }
    return content;
  }

  /** Relative paths, recursive, the shape `FileAdapter` returns. */
  async listDirectory(dirPath: string): Promise<string[]> {
    const normalizedDir = dirKey(dirPath);
    if (!this.directories.has(normalizedDir)) throw enoent("scandir", normalizedDir);
    const prefix = normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`;
    const result: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        result.push(key.slice(prefix.length));
      }
    }
    return result;
  }

  async fileExists(path: string): Promise<boolean> {
    const normalizedPath = norm(path);
    return this.files.has(normalizedPath) || this.directories.has(dirKey(path));
  }

  async readFileHash(path: string): Promise<FileHash> {
    const content = await this.readFile(path);
    return this.hasher.hash(content);
  }

  /** Resolves through the longest matching registered symlink, like a real `fs.realpath`
   * walking a symlinked ancestor; identity when none was declared for the path. */
  async realpath(path: string): Promise<string> {
    const key = norm(resolve(path));
    let bestMatch: { link: string; target: string } | undefined;
    for (const [link, target] of this.symlinks) {
      if (key === link || key.startsWith(`${link}/`)) {
        if (bestMatch === undefined || link.length > bestMatch.link.length) {
          bestMatch = { link, target };
        }
      }
    }
    // `posix.normalize`, not `resolve`: a virtual `/project/file` stays drive-free on Windows.
    const resolved =
      bestMatch === undefined
        ? posix.normalize(norm(path))
        : bestMatch.target + key.slice(bestMatch.link.length);
    if (this.missingRealpathRejects && !(await this.existsIgnoringDrive(resolved))) {
      throw enoent("realpath", norm(path));
    }
    return resolved;
  }

  /** Opt-in: `realpath` of a path that is neither a file nor a known directory rejects with
   * `ENOENT`, as the real adapter does. Off by default, where it answers the path: the importers
   * that never seed their project roots rely on that until each context's kit seeds them. */
  rejectMissingRealpath(): this {
    this.missingRealpathRejects = true;
    return this;
  }

  /** Test-only: declares that `path` is a symlink resolving to `target`, so a test can
   * prove `realpath`-based containment without touching a real filesystem. */
  setSymlink(path: string, target: string): void {
    this.symlinks.set(norm(resolve(path)), norm(target));
  }

  async mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void> {
    return mergeIntoJsonFile(this, path, content, strategy);
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const normalizedDir = dirKey(dirPath);
    const prefix = normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`;
    for (const key of [...this.files.keys()]) {
      if (key.startsWith(prefix) || key === normalizedDir) {
        this.files.delete(key);
      }
    }
    for (const dir of [...this.directories]) {
      if (dir.startsWith(prefix) || dir === normalizedDir) {
        this.directories.delete(dir);
      }
    }
  }

  async listFilesRecursive(dirPath: string): Promise<string[]> {
    const normalizedDir = norm(dirPath);
    const prefix = normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`;
    const result: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        result.push(join(dirPath, key.slice(prefix.length)));
      }
    }
    return result;
  }

  setFile(path: string, content: string): void {
    const key = norm(path);
    this.files.set(key, content);
    this.registerAncestors(key);
  }

  /** On Windows, product code resolves a virtual `/project` to `D:\project` (the working drive)
   * before asking `realpath`; the tree was seeded drive-free, so a drive-qualified path also
   * matches its drive-free spelling. */
  private async existsIgnoringDrive(path: string): Promise<boolean> {
    return (await this.fileExists(path)) || (await this.fileExists(path.replace(DRIVE_PREFIX, "")));
  }

  private registerAncestors(key: string): void {
    let parent = posix.dirname(key);
    while (parent !== "." && !this.directories.has(parent)) {
      this.directories.add(parent);
      const next = posix.dirname(parent);
      if (next === parent) break;
      parent = next;
    }
  }

  private holdsAnything(dir: string): boolean {
    const prefix = dir.endsWith("/") ? dir : `${dir}/`;
    for (const key of this.files.keys()) if (key.startsWith(prefix)) return true;
    for (const other of this.directories) if (other.startsWith(prefix)) return true;
    return false;
  }

  getFile(path: string): string | undefined {
    return this.files.get(norm(path));
  }

  has(path: string): boolean {
    return this.files.has(norm(path));
  }

  listAll(): string[] {
    return [...this.files.keys()];
  }

  listUnder(dirPath: string): string[] {
    const normalizedDir = norm(dirPath);
    const prefix = normalizedDir.endsWith("/") ? normalizedDir : `${normalizedDir}/`;
    return [...this.files.keys()].filter((k) => k.startsWith(prefix));
  }
}

// A real Windows filesystem accepts "/" and "\" as equivalent; this Map<path, content>
// double does not unless every path put through it is normalized to one spelling first.
const DRIVE_PREFIX = /^[A-Za-z]:(?=\/)/;

function norm(path: string): string {
  return path.replaceAll("\\", "/");
}

// The real adapter's `stat` and `readdir` accept a trailing separator on a directory, and
// callers spell directories that way (`status-use-case.ts` joins a tool directory ending in "/").
function dirKey(path: string): string {
  const key = norm(path);
  return key.length > 1 && key.endsWith("/") ? key.replace(/\/+$/, "") || "/" : key;
}

function enoent(syscall: string, path: string): Error {
  return Object.assign(new Error(`ENOENT: no such file or directory, ${syscall} '${path}'`), {
    code: "ENOENT",
  });
}

class DefaultHasher implements Hasher {
  hash(content: string): FileHash {
    const hex = createHash("md5").update(content, "utf-8").digest("hex");
    return new FileHash(hex);
  }
}
