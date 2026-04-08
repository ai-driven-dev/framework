import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { FileHash } from "../../domain/models/file-hash.js";
import type { MergeStrategy } from "../../domain/models/merge-strategy.js";
import type { FileSystem } from "../../domain/ports/file-system.js";
import type { Hasher } from "../../domain/ports/hasher.js";
import { JsonParseError } from "../errors.js";

export class FileSystemAdapter implements FileSystem {
  constructor(private readonly hasher: Hasher) {}

  async writeFile(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async deleteFile(path: string): Promise<void> {
    try {
      await rm(path, { force: true });
    } catch {
      // No error if missing
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
      if (entry.isDirectory()) {
        await this.collectFiles(baseDir, fullPath, results);
      } else {
        results.push(relative(baseDir, fullPath));
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

  async readFileHash(path: string): Promise<FileHash> {
    const content = await this.readFile(path);
    return this.hasher.hash(content);
  }

  async deleteDirectory(path: string): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }

  async chmodExecutable(path: string): Promise<void> {
    await chmod(path, 0o755);
  }

  async hasLocalChanges(path: string, knownHash: FileHash): Promise<boolean> {
    if (!(await this.fileExists(path))) return false;
    const diskHash = await this.readFileHash(path);
    return diskHash.value !== knownHash.value;
  }

  async backup(absolutePath: string): Promise<string> {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[^0-9T]/g, "");
    const backupPath = `${absolutePath}.bak.${timestamp}`;
    await copyFile(absolutePath, backupPath);
    return backupPath;
  }

  async mergeJsonFile(path: string, content: string, strategy: MergeStrategy): Promise<void> {
    let existing: Record<string, unknown> = {};

    try {
      const raw = await readFile(path, "utf-8");
      existing = JSON.parse(stripJsoncComments(raw)) as Record<string, unknown>;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw new JsonParseError(path, (err as Error).message);
      }
    }

    const incoming = JSON.parse(stripJsoncComments(content)) as Record<string, unknown>;
    const merged =
      strategy === "user-prime" ? deepMerge(incoming, existing) : deepMerge(existing, incoming);
    await this.writeFile(path, JSON.stringify(merged, null, 2));
  }
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = result[key];

    if (Array.isArray(value) && Array.isArray(existing)) {
      // Deduplicate arrays by JSON-serialized key — works for both primitives and objects
      const combined = [...existing, ...value];
      result[key] = [...new Map(combined.map((v) => [JSON.stringify(v), v])).values()];
    } else if (isPlainObject(value) && isPlainObject(existing)) {
      result[key] = deepMerge(
        existing as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      // Scalars from new data override
      result[key] = value;
    }
  }

  return result;
}

function isPlainObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stripJsoncComments(content: string): string {
  let result = "";
  let i = 0;
  let inString = false;

  while (i < content.length) {
    const ch = content[i];

    if (inString) {
      if (ch === "\\") {
        result += ch + content[i + 1];
        i += 2;
        continue;
      }
      if (ch === '"') inString = false;
      result += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }

    if (ch === "/" && content[i + 1] === "/") {
      while (i < content.length && content[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && content[i + 1] === "*") {
      i += 2;
      while (i < content.length && !(content[i] === "*" && content[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === ",") {
      let j = i + 1;
      while (j < content.length && " \t\n\r".includes(content[j])) j++;
      if (content[j] === "}" || content[j] === "]") {
        i++;
        continue;
      }
    }

    result += ch;
    i++;
  }

  return result;
}
