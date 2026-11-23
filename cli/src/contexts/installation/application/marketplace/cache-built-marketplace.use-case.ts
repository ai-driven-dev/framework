import { join, resolve } from "node:path";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../../shared/domain/layout/aidd-layout.js";
import { pathsOverlap } from "../../../../shared/domain/paths.model.js";
import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type {
  EnsureBuiltMarketplaceRequest,
  EnsureBuiltMarketplaceResult,
  ResolvedMarketplace,
} from "../../contract/built-marketplace.js";

export type CacheBuiltMarketplaceRequest = EnsureBuiltMarketplaceRequest;

/** One framework build, as the cache runs it. Its result is not read. */
export interface FrameworkBuild {
  execute(options: {
    readonly sourceDir: string;
    readonly outDir: string;
    readonly target: AiToolId;
    readonly mode?: FrameworkBuildMode;
  }): Promise<unknown>;
}

/** The framework builds of every target, and what one target's build differs by. */
export interface FrameworkBuilds {
  /** What a target's built tree carries beyond its source, such as the provider its agents run
   * on, or `undefined` when nothing. A changed variant makes a cached tree stale. */
  variant(target: AiToolId): Promise<string | undefined>;
  /** `undefined` when the target/mode pair has no build. */
  buildFor(request: {
    target: AiToolId;
    mode: FrameworkBuildMode;
    outDir: string;
    variant?: string;
  }): FrameworkBuild | undefined;
}

interface BuildJob {
  target: AiToolId;
  mode: FrameworkBuildMode;
  sourceDir: string;
  builtDir: string;
  variant: string | undefined;
}

interface EnsureJob extends BuildJob {
  sentinel: string;
  versionIsTrustworthy: boolean;
}

const SENTINEL_FILE = ".build-version";
const UNVERSIONED = "unversioned";

/** What CacheBuiltMarketplace is built from. */
export interface CacheBuiltMarketplaceDeps {
  readonly fs: FileReader & FileWriter;
  readonly builds: FrameworkBuilds;
  readonly version: string;
  /**
   * Where a user-scope marketplace's built tree belongs. Building it under the project that
   * happened to register it would tie a declaration meant for every project to the life of one
   * of them: delete that project and the global registration points at nothing.
   */
  readonly userCacheRoot: () => string;
  /** A new empty directory only this process can use, where a build is staged before it replaces
   * the cache. A predictable shared path would let another local user pre-create or link it. */
  readonly createStagingDirectory: () => Promise<string>;
}

/**
 * The disk half of the ensurer: staleness, the build and the guard-safe outDir (build to temp then
 * copy when the cache nests under the source), for a source already resolved.
 */
export class CacheBuiltMarketplace {
  private readonly memo = new Map<string, EnsureBuiltMarketplaceResult>();

  constructor(private readonly deps: CacheBuiltMarketplaceDeps) {}

  async execute(
    options: CacheBuiltMarketplaceRequest,
    resolved: ResolvedMarketplace
  ): Promise<EnsureBuiltMarketplaceResult> {
    // `resolve()`, matching `sourceDir` below: on Windows a drive-less `projectRoot` yields a
    // drive-less `builtDir` here while the build resolves its own outDir copy for validation only,
    // leaving the write target diverging from the path that gets checked. Both scopes need it.
    const builtDir = resolve(
      options.marketplace.scope === "user"
        ? userBuiltMarketplaceDir({
            userConfigDir: this.deps.userCacheRoot(),
            cliVersion: this.deps.version,
            marketplaceName: options.marketplace.name,
            target: options.target,
          })
        : builtMarketplaceDir(options.projectRoot, options.marketplace.name, options.target)
    );
    const variant = await this.deps.builds.variant(options.target);
    const sentinel = this.sentinelValue(resolved.catalog?.version, variant);
    const memoKey = `${options.marketplace.name}:${options.target}:${sentinel}`;
    const memoized = this.memo.get(memoKey);
    if (memoized !== undefined) return memoized;
    const result = await this.ensure({
      target: options.target,
      mode: options.mode,
      builtDir,
      sourceDir: resolve(resolved.localPath),
      sentinel,
      versionIsTrustworthy: this.versionIsTrustworthy(options),
      variant,
    });
    this.memo.set(memoKey, result);
    return result;
  }

  private sentinelValue(catalogVersion: string | undefined, variant: string | undefined): string {
    const base = `${this.deps.version}:${catalogVersion ?? UNVERSIONED}`;
    return variant === undefined ? base : `${base}:${variant}`;
  }

  /**
   * Whether the catalog version can be believed when it says nothing changed. For a published
   * source it can: different content carries a different version. For a directory on this machine
   * it cannot: someone edits a file and the version stays put, which is the whole of framework
   * development, and an explicit refresh asks for the source to be re-read.
   *
   * Rebuilding the real framework costs about two tenths of a second, so the safe answer is also
   * the cheap one.
   */
  private versionIsTrustworthy(options: EnsureBuiltMarketplaceRequest): boolean {
    if (options.forceRefresh === true) return false;
    return options.marketplace.source.kind !== "local";
  }

  private async ensure(job: EnsureJob): Promise<EnsureBuiltMarketplaceResult> {
    const { builtDir, sentinel, versionIsTrustworthy } = job;
    const version = sentinel.split(":")[1];
    if (versionIsTrustworthy && (await this.isFresh(builtDir, sentinel))) {
      return { builtDir, version, rebuilt: false };
    }
    await this.build(job);
    await this.deps.fs.writeFile(join(builtDir, SENTINEL_FILE), sentinel);
    return { builtDir, version, rebuilt: true };
  }

  private async isFresh(builtDir: string, sentinel: string): Promise<boolean> {
    // The catalog version sits second, whatever variant follows it.
    if (sentinel.split(":")[1] === UNVERSIONED) return false;
    const path = join(builtDir, SENTINEL_FILE);
    if (!(await this.deps.fs.fileExists(path))) return false;
    return (await this.deps.fs.readFileIfReadable(path)) === sentinel;
  }

  private async build(job: BuildJob): Promise<void> {
    if (this.nested(job.sourceDir, job.builtDir)) {
      await this.buildViaTemp(job);
      return;
    }
    await this.runBuild({ ...job, outDir: job.builtDir });
  }

  private nested(sourceDir: string, builtDir: string): boolean {
    return pathsOverlap(sourceDir, builtDir);
  }

  private async buildViaTemp(job: BuildJob): Promise<void> {
    const { builtDir } = job;
    const temp = await this.deps.createStagingDirectory();
    await this.runBuild({ ...job, outDir: temp });
    await this.deps.fs.deleteDirectory(builtDir);
    await this.copyDir(temp, builtDir);
    await this.deps.fs.deleteDirectory(temp);
  }

  // Every outDir reaching this method is either `builtMarketplaceDir()` or a fresh staging dir:
  // an aidd-owned cache, never a user directory, so a collision here is stale-cache reuse, not
  // data loss.
  private async runBuild(job: BuildJob & { outDir: string }): Promise<void> {
    const { target, mode, sourceDir, outDir, variant } = job;
    await this.deps.fs.createDirectory(outDir);
    const build = this.deps.builds.buildFor({ target, mode, outDir, variant });
    if (build === undefined) {
      throw new Error(`No framework build for target '${target}' mode '${mode}'.`);
    }
    await build.execute({ sourceDir, outDir, target, mode });
  }

  private async copyDir(from: string, to: string): Promise<void> {
    const files = await this.deps.fs.listFilesRecursive(from);
    for (const abs of files) {
      const rel = abs.slice(from.length + 1);
      const content = await this.deps.fs.readFile(abs);
      await this.deps.fs.writeFile(join(to, rel), content);
    }
  }
}
