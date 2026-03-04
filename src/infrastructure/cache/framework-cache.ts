import { access, cp, mkdir, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
      await Promise.all([access(join(dir, MARKER_FILE)), access(join(dir, "framework.json"))]);
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

function isSemver(s: string): boolean {
  return /^\d+\.\d+\.\d+/.test(s);
}

function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = parseSemver(a);
  const [bMaj, bMin, bPatch] = parseSemver(b);
  return aMaj - bMaj || aMin - bMin || aPatch - bPatch;
}

function parseSemver(v: string): [number, number, number] {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
