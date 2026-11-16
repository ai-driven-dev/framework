import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../../shared/domain/layout/aidd-layout.js";
import { pathsOverlap } from "../../../../shared/domain/paths.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../shared/ports/file-writer.js";
import type { VersionReader } from "../../../../shared/ports/version-reader.js";
import type { FrameworkBuildMode } from "../../../tools/contract/tool-profile.js";
import type { FrameworkBuild } from "../../../translate/contract/build-native-tree.js";
import type { FrameworkBuildTarget } from "../../../translate/contract/build-targets.js";
import type { DeclaredMarketplace, MarketplaceResolver } from "../../ports/marketplace-sources.js";

/** The framework builds of every target, and what one target's build differs by. */
export interface FrameworkBuilds {
  /** What a target's built tree carries beyond its source, such as the provider its agents run
   * on, or `undefined` when nothing. A changed variant makes a cached tree stale. */
  variant(target: FrameworkBuildTarget): Promise<string | undefined>;
  /** `undefined` when the target/mode pair has no build. */
  buildFor(
    target: FrameworkBuildTarget,
    mode: FrameworkBuildMode,
    outDir: string,
    variant?: string
  ): FrameworkBuild | undefined;
}

export interface EnsureBuiltMarketplaceCommand {
  readonly projectRoot: string;
  readonly marketplace: DeclaredMarketplace;
  readonly target: FrameworkBuildTarget;
  readonly mode: FrameworkBuildMode;
  readonly forceRefresh?: boolean;
}

export interface EnsureBuiltMarketplaceResult {
  readonly builtDir: string;
  readonly version: string | undefined;
  readonly rebuilt: boolean;
}

const SENTINEL_FILE = ".build-version";
const UNVERSIONED = "unversioned";

/**
 * Guarantees a per-target built tree exists in cache, so install consumers read the same
 * transformed content a build produces. Owns source resolution, staleness, and the guard-safe
 * outDir: build to temp then copy when the cache nests under the source.
 */
export interface BuiltMarketplaceEnsurer {
  execute(options: EnsureBuiltMarketplaceCommand): Promise<EnsureBuiltMarketplaceResult>;
}

export class EnsureBuiltMarketplace implements BuiltMarketplaceEnsurer {
  private readonly memo = new Map<string, EnsureBuiltMarketplaceResult>();

  constructor(
    private readonly fs: FileReader & FileWriter,
    private readonly resolveMarketplace: MarketplaceResolver,
    private readonly builds: FrameworkBuilds,
    private readonly version: VersionReader,
    /**
     * Where a user-scope marketplace's built tree belongs. Building it under the project that
     * happened to register it would tie a declaration meant for every project to the life of one
     * of them: delete that project and the global registration points at nothing.
     */
    private readonly userCacheRoot: () => string
  ) {}

  async execute(options: EnsureBuiltMarketplaceCommand): Promise<EnsureBuiltMarketplaceResult> {
    // `resolve()`, matching `sourceDir` below: on Windows a drive-less `projectRoot` yields a
    // drive-less `builtDir` here while the build resolves its own outDir copy for validation only,
    // leaving the write target diverging from the path that gets checked. Both scopes need it.
    const builtDir = resolve(
      options.marketplace.scope === "user"
        ? userBuiltMarketplaceDir(
            this.userCacheRoot(),
            this.version.get(),
            options.marketplace.name,
            options.target
          )
        : builtMarketplaceDir(options.projectRoot, options.marketplace.name, options.target)
    );
    const resolved = await this.resolveMarketplace.execute({
      marketplace: options.marketplace,
      projectRoot: options.projectRoot,
      forceRefresh: options.forceRefresh,
    });
    const variant = await this.builds.variant(options.target);
    const sentinel = this.sentinelValue(resolved.catalog?.version, variant);
    const memoKey = `${options.marketplace.name}:${options.target}:${sentinel}`;
    const memoized = this.memo.get(memoKey);
    if (memoized !== undefined) return memoized;
    const result = await this.ensure(
      options,
      builtDir,
      resolve(resolved.localPath),
      sentinel,
      this.versionIsTrustworthy(options),
      variant
    );
    this.memo.set(memoKey, result);
    return result;
  }

  private sentinelValue(catalogVersion: string | undefined, variant: string | undefined): string {
    const base = `${this.version.get()}:${catalogVersion ?? UNVERSIONED}`;
    return variant === undefined ? base : `${base}:${variant}`;
  }

  /**
   * Whether the catalog version can be believed when it says nothing changed. For a published
   * source it can: different content carries a different version. For a directory on this machine
   * it cannot — someone edits a file and the version stays put, which is the whole of framework
   * development — and an explicit refresh asks for the source to be re-read.
   *
   * Rebuilding the real framework costs about two tenths of a second, so the safe answer is also
   * the cheap one.
   */
  private versionIsTrustworthy(options: EnsureBuiltMarketplaceCommand): boolean {
    if (options.forceRefresh === true) return false;
    return options.marketplace.source.kind !== "local";
  }

  private async ensure(
    options: EnsureBuiltMarketplaceCommand,
    builtDir: string,
    sourceDir: string,
    sentinel: string,
    versionIsTrustworthy: boolean,
    variant: string | undefined
  ): Promise<EnsureBuiltMarketplaceResult> {
    const version = sentinel.split(":")[1];
    if (versionIsTrustworthy && (await this.isFresh(builtDir, sentinel))) {
      return { builtDir, version, rebuilt: false };
    }
    await this.build(options.target, options.mode, sourceDir, builtDir, variant);
    await this.fs.writeFile(join(builtDir, SENTINEL_FILE), sentinel);
    return { builtDir, version, rebuilt: true };
  }

  private async isFresh(builtDir: string, sentinel: string): Promise<boolean> {
    // The catalog version sits second, whatever variant follows it.
    if (sentinel.split(":")[1] === UNVERSIONED) return false;
    const path = join(builtDir, SENTINEL_FILE);
    if (!(await this.fs.fileExists(path))) return false;
    const current = await this.fs.readFile(path).catch(() => "");
    return current === sentinel;
  }

  private async build(
    target: FrameworkBuildTarget,
    mode: FrameworkBuildMode,
    sourceDir: string,
    builtDir: string,
    variant: string | undefined
  ): Promise<void> {
    if (this.nested(sourceDir, builtDir)) {
      await this.buildViaTemp(target, mode, sourceDir, builtDir, variant);
      return;
    }
    await this.runBuild(target, mode, sourceDir, builtDir, variant);
  }

  private nested(sourceDir: string, builtDir: string): boolean {
    return pathsOverlap(sourceDir, builtDir);
  }

  private async buildViaTemp(
    target: FrameworkBuildTarget,
    mode: FrameworkBuildMode,
    sourceDir: string,
    builtDir: string,
    variant: string | undefined
  ): Promise<void> {
    const temp = join(tmpdir(), `aidd-built-${target}-${mode}`);
    await this.fs.deleteDirectory(temp);
    await this.runBuild(target, mode, sourceDir, temp, variant);
    await this.fs.deleteDirectory(builtDir);
    await this.copyDir(temp, builtDir);
    await this.fs.deleteDirectory(temp);
  }

  // Every outDir reaching this method is either `builtMarketplaceDir()` or a temp dir this class
  // just deleted — an aidd-owned cache, never a user directory — so a collision here is stale-cache
  // reuse, not data loss.
  private async runBuild(
    target: FrameworkBuildTarget,
    mode: FrameworkBuildMode,
    sourceDir: string,
    outDir: string,
    variant: string | undefined
  ): Promise<void> {
    await this.fs.createDirectory(outDir);
    const build = this.builds.buildFor(target, mode, outDir, variant);
    if (build === undefined) {
      throw new Error(`No framework build for target '${target}' mode '${mode}'.`);
    }
    await build.execute({ sourceDir, outDir, target, mode });
  }

  private async copyDir(from: string, to: string): Promise<void> {
    const files = await this.fs.listFilesRecursive(from);
    for (const abs of files) {
      const rel = abs.slice(from.length + 1);
      const content = await this.fs.readFile(abs);
      await this.fs.writeFile(join(to, rel), content);
    }
  }
}
