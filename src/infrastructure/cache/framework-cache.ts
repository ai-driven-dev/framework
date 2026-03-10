import { access, cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareSemver, isSemver } from "../../domain/models/semver.js";

const DEFAULT_CACHE_BASE = join(tmpdir(), "aidd-cache");
const MARKER_FILE = ".aidd-extracted";

export class FrameworkCache {
  private readonly base: string;

  constructor(base?: string) {
    this.base = base ?? DEFAULT_CACHE_BASE;
  }

  private cacheDir(version: string): string {
    return join(this.base, version);
  }

  async has(version: string): Promise<boolean> {
    const dir = this.cacheDir(version);
    try {
      await access(join(dir, MARKER_FILE));
      return true;
    } catch {
      return false;
    }
  }

  get(version: string): string {
    return this.cacheDir(version);
  }

  async put(version: string, extractedDir: string): Promise<void> {
    const target = this.cacheDir(version);
    await mkdir(target, { recursive: true });
    await cp(extractedDir, target, { recursive: true, force: true });
    await writeFile(join(target, MARKER_FILE), "");
  }

  async list(): Promise<Array<{ version: string; path: string; size: number }>> {
    let entries: string[];
    try {
      entries = await readdir(this.base);
    } catch {
      return [];
    }

    const versions = entries.filter(isSemver);
    const result: Array<{ version: string; path: string; size: number }> = [];

    for (const version of versions) {
      const dir = this.cacheDir(version);
      try {
        const size = await getDirSize(dir);
        result.push({ version, path: dir, size });
      } catch {
        // skip unreadable entries
      }
    }

    result.sort((a, b) => compareSemver(a.version, b.version));
    return result;
  }

  async clear(version?: string): Promise<void> {
    if (version !== undefined) {
      const exists = await this.has(version);
      if (!exists) throw new Error(`No cached framework found for version '${version}'.`);
      await rm(this.cacheDir(version), { recursive: true, force: true });
      return;
    }

    let entries: string[];
    try {
      entries = await readdir(this.base);
    } catch {
      return;
    }

    for (const entry of entries.filter(isSemver)) {
      await rm(join(this.base, entry), { recursive: true, force: true });
    }
  }

  async getLatestCached(): Promise<string | null> {
    let entries: string[];
    try {
      entries = await readdir(this.base);
    } catch {
      return null;
    }

    const versions = entries.filter(isSemver);
    if (versions.length === 0) return null;

    versions.sort(compareSemver);
    return versions[versions.length - 1];
  }
}

async function getDirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await getDirSize(full);
    } else {
      const s = await stat(full);
      total += s.size;
    }
  }
  return total;
}
