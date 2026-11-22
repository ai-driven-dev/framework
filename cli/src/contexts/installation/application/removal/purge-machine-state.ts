import {
  USER_SOURCE_REFERENCES_FILENAME,
  userBuiltCacheRoot,
} from "../../../../shared/domain/layout/aidd-layout.js";
import { isErrnoException } from "../../../../shared/domain/reading/json-file.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../shared/ports/logger.js";
import type { MachineStatePurge } from "../../ports/user-scope-purge.js";

/** The path under `cacheRoot` when it stays inside it, else `null`. */
export type CacheCandidateResolver = (
  cacheRoot: string,
  relativeSegments: string,
  label: string
) => Promise<string | null>;

/** What a machine-scope purge asks of the machine, answered where each one lives. */
export interface MachineStateGuards {
  readonly userConfigDir: () => string;
  readonly resolveCacheCandidate: CacheCandidateResolver;
  /** The name the framework marketplace is registered under. */
  readonly frameworkMarketplaceName: string;
}

/** What PurgeMachineState is built from. */
export interface PurgeMachineStateDeps {
  readonly fs: FileReader & FileWriter;
  readonly logger: Logger;
  readonly guards: MachineStateGuards;
}

/** What a machine-scope clean removes from the machine itself: the whitelisted directories and
 * files under the user config directory, each behind its containment check. */
export class PurgeMachineState implements MachineStatePurge {
  constructor(private readonly deps: PurgeMachineStateDeps) {}

  /** Every version directory found under `userConfigDir()/cache/built/`, read structurally and
   * never trusted from any one tool's own manifest entry. */
  async builtVersions(): Promise<readonly string[]> {
    const root = userBuiltCacheRoot(this.deps.guards.userConfigDir());
    let entries: string[];
    try {
      entries = await this.deps.fs.listDirectory(root);
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return [];
      throw error;
    }
    const versions = new Set<string>();
    for (const entry of entries) {
      const version = entry.split("/")[0];
      if (version) versions.add(version);
    }
    return [...versions].sort();
  }

  /** Removes the whitelisted machine state. */
  async purge(): Promise<void> {
    await this.purgeWhitelistedPath("cache/built", (candidate) =>
      this.deps.fs.deleteDirectory(candidate)
    );
    // Other user marketplaces keep their registered sources. Plugin fetches belong to the
    // machine manifest being removed, whose active dependents were checked before any purge.
    const frameworkSource = `cache/marketplaces/${this.deps.guards.frameworkMarketplaceName}`;
    for (const path of [frameworkSource, "cache/plugin-cache"]) {
      await this.purgeWhitelistedPath(path, (candidate) => this.deps.fs.deleteDirectory(candidate));
    }
    await this.purgeEmptyCacheShell("cache/marketplaces");
    // The self-update check cache, written into the same `cache/` directory by any online
    // command: left behind it keeps the shell below non-empty, the one occupant that made
    // "leaves nothing of aidd's on the machine" false in the ordinary case.
    await this.purgeWhitelistedPath("cache/update-check.json", (candidate) =>
      this.deps.fs.deleteFile(candidate)
    );
    await this.purgeEmptyCacheShell();
    // Where the same cache was written before it moved under `cache/`; the reader still falls
    // back to it and an older CLI on this machine may still write it.
    await this.purgeWhitelistedPath("update-check.json", (candidate) =>
      this.deps.fs.deleteFile(candidate)
    );
    await this.purgeWhitelistedPath(USER_SOURCE_REFERENCES_FILENAME, (candidate) =>
      this.deps.fs.deleteFile(candidate)
    );
  }

  /** Remove a cache directory only once proven empty, with the same containment as every
   * whitelist candidate: another marketplace or a future cache writer may still use it. */
  private async purgeEmptyCacheShell(path = "cache"): Promise<void> {
    const candidate = await this.deps.guards.resolveCacheCandidate(
      this.deps.guards.userConfigDir(),
      path,
      `user scope: ${path}`
    );
    if (candidate === null) return;
    let entries: string[];
    try {
      entries = await this.deps.fs.listDirectory(candidate);
    } catch (error) {
      if (isErrnoException(error) && error.code === "ENOENT") return;
      throw error;
    }
    if (entries.length > 0) return;
    await this.deps.fs.deleteDirectory(candidate);
    this.deps.logger.info(`user scope: ${path} purged: ${candidate}`);
  }

  /** Never `userConfigDir()` itself, and never on a manifest's word: every fixed whitelist entry
   * is still resolved through the containment check before it is touched, defense in depth
   * against one of those directories having become a symlink since it was last written. */
  private async purgeWhitelistedPath(
    path: string,
    remove: (candidate: string) => Promise<void>
  ): Promise<void> {
    const candidate = await this.deps.guards.resolveCacheCandidate(
      this.deps.guards.userConfigDir(),
      path,
      `user scope: ${path}`
    );
    if (candidate === null) return;
    await remove(candidate);
    this.deps.logger.info(`user scope: ${path} purged: ${candidate}`);
  }
}
