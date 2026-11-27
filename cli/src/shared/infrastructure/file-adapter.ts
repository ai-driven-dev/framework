import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, realpath, rm, rmdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FileHash } from "../domain/file-hash.js";
import { whenAbsent } from "../domain/reading/json-file.js";
import type { FileReader } from "../ports/file-reader.js";
import type { FileWriter } from "../ports/file-writer.js";
import type { Logger } from "../ports/logger.js";
import { atomicWriteFile } from "./atomic-write.js";

export class FileAdapter implements FileReader, FileWriter {
  async isDirectory(path: string): Promise<boolean> {
    // biome-ignore lint/plugin: the port answers false for a path that cannot be probed
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  async isExecutable(path: string): Promise<boolean> {
    // biome-ignore lint/plugin: the port answers false for a file that cannot be probed
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  constructor(private readonly logger?: Logger) {}

  async writeFile(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await atomicWriteFile(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    // biome-ignore lint/plugin: a refusal to delete something present must not fail an uninstall midway
    try {
      await rm(path);
    } catch {
      // Absence and a refusal to delete something that is there are both swallowed: neither
      // may fail an uninstall midway.
    }
  }

  async createDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  async deleteEmptyDirectories(path: string, floor?: string): Promise<void> {
    let current = path;
    while (current !== floor) {
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
    await this.collectFiles({ dir: path, named: "" }, results);
    return results;
  }

  private async collectFiles(
    current: { dir: string; named: string },
    results: string[]
  ): Promise<void> {
    const entries = await readdir(current.dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current.dir, entry.name);
      const named = `${current.named}${entry.name}`;
      if (entry.isSymbolicLink()) {
        this.logger?.warn(`Skipping symlink: ${fullPath}`);
        continue;
      }
      if (entry.isDirectory()) {
        await this.collectFiles({ dir: fullPath, named: `${named}/` }, results);
      } else {
        results.push(named);
      }
    }
  }

  async fileExists(path: string): Promise<boolean> {
    // biome-ignore lint/plugin: the port answers false for a path that cannot be probed
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

  async readFileIfReadable(path: string): Promise<string | undefined> {
    // biome-ignore lint/plugin: the port answers undefined for a file that cannot be read, for any reason
    return readFile(path, "utf-8").catch(() => undefined);
  }

  async realpathIfResolvable(path: string): Promise<string | undefined> {
    // biome-ignore lint/plugin: the port answers undefined for a path that cannot be resolved, for any reason
    return realpath(path).catch(() => undefined);
  }

  async readFileHash(path: string): Promise<FileHash> {
    const content = await this.readFile(path);
    return FileHash.of(content);
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
    const entries = await whenAbsent(() => readdir(dir, { withFileTypes: true }), undefined);
    if (entries === undefined) return;
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
}
