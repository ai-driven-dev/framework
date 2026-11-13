import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, realpath, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { FileHash } from "../../kernel/file.js";
import { type MergeStrategy, mergeIntoJsonFile } from "../../kernel/merge.js";
import { posixRelative } from "../../kernel/paths.js";
import type { FileReader } from "../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../kernel/ports/file-writer.js";
import type { Hasher } from "../../kernel/ports/hasher.js";
import type { Logger } from "../../kernel/ports/logger.js";
import type { FileMerger } from "../ports/file-merger.js";
import { atomicWriteFile } from "./atomic-write.js";

export class FileAdapter implements FileReader, FileWriter, FileMerger {
  async isExecutable(path: string): Promise<boolean> {
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  constructor(
    private readonly hasher: Hasher,
    private readonly logger?: Logger
  ) {}

  async writeFile(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await atomicWriteFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await rm(path, { force: true });
    } catch {
      // `force` already covers absence; what is swallowed here is a refusal to delete
      // something that is there, which must not fail an uninstall midway.
    }
  }

  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async deleteEmptyDirectories(path: string): Promise<void> {
    let current = path;
    while (true) {
      let entries: string[];
      try {
        const dirents = await readdir(current);
        entries = dirents;
      } catch {
        break;
      }

      if (entries.length > 0) break;

      try {
        await rmdir(current);
      } catch {
        break;
      }

      current = dirname(current);
    }
  }

  async readFile(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async listDirectory(path: string): Promise<string[]> {
    const results: string[] = [];
    await this.collectFiles(path, path, results);
    return results;
  }

  private async collectFiles(
    baseDir: string,
    currentDir: string,
    results: string[]
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isSymbolicLink()) {
        this.logger?.warn(`Skipping symlink: ${fullPath}`);
        continue;
      }
      if (entry.isDirectory()) {
        await this.collectFiles(baseDir, fullPath, results);
      } else {
        results.push(posixRelative(baseDir, fullPath));
      }
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async realpath(path: string): Promise<string> {
    return realpath(path);
  }

  async readFileHash(path: string): Promise<FileHash> {
    const content = await this.readFile(path);
    return this.hasher.hash(content);
  }

  async deleteDirectory(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async listFilesRecursive(dirPath: string): Promise<string[]> {
    const results: string[] = [];
    await this.collectAbsolutePaths(dirPath, results);
    return results;
  }

  private async collectAbsolutePaths(dir: string, results: string[]): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        this.logger?.warn(`Skipping symlink: ${fullPath}`);
        continue;
      }
      if (entry.isDirectory()) {
        await this.collectAbsolutePaths(fullPath, results);
      } else {
        results.push(fullPath);
      }
    }
  }

  async mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void> {
    return mergeIntoJsonFile(this, path, content, strategy);
  }
}
