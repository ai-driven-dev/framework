import { homedir } from "node:os";
import { join } from "node:path";
import { compareSemver, isSemver } from "../../domain/models/semver.js";
import type { FileReader } from "../../domain/ports/file-reader.js";
import type { FileWriter } from "../../domain/ports/file-writer.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { SelfUpdater } from "../../domain/ports/self-updater.js";
import type { VersionReader } from "../../domain/ports/version-reader.js";

const CHECK_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CheckUpdateOptions {
  skipCliCheck?: boolean;
}

interface CachedCheck {
  checkedAt: number;
  latest: string;
}

function isOutdated(version: string, latest: string): boolean {
  return isSemver(version) && compareSemver(version, latest) < 0;
}

function resolveCachePath(): string {
  const dir = process.env.AIDD_USER_CONFIG_DIR ?? join(homedir(), ".config", "aidd");
  return join(dir, "update-check.json");
}

export class CheckUpdateUseCase {
  constructor(
    private readonly cliUpdater: SelfUpdater,
    private readonly versionReader: VersionReader,
    private readonly logger: Logger,
    private readonly fs: FileReader & FileWriter
  ) {}

  async execute(options: CheckUpdateOptions = {}): Promise<void> {
    if (options.skipCliCheck) return;
    try {
      const current = this.versionReader.get();
      const latest = await this.resolveLatest();
      if (latest === null) return;
      if (isOutdated(current, latest)) {
        this.logger.warn(
          `CLI update available: v${current.replace(/^v/, "")} → v${latest.replace(/^v/, "")}`
        );
        this.logger.warn("Run `aidd self-update`.");
      }
    } catch (err) {
      this.logger.debug(
        `CLI update check failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  private async resolveLatest(): Promise<string | null> {
    const cached = await this.readCache();
    if (cached !== null) return cached.latest;
    const { version: latest } = await this.cliUpdater.fetchLatestRelease();
    await this.writeCache(latest);
    return latest;
  }

  private async readCache(): Promise<CachedCheck | null> {
    const path = resolveCachePath();
    if (!(await this.fs.fileExists(path))) return null;
    try {
      const raw = await this.fs.readFile(path);
      const data = JSON.parse(raw) as CachedCheck;
      if (Date.now() - data.checkedAt > CHECK_TTL_MS) return null;
      return data;
    } catch {
      return null;
    }
  }

  private async writeCache(latest: string): Promise<void> {
    try {
      const path = resolveCachePath();
      await this.fs.createDirectory(join(path, ".."));
      await this.fs.writeFile(path, JSON.stringify({ checkedAt: Date.now(), latest }));
    } catch {
      /* cache write best-effort */
    }
  }
}
