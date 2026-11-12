import { join, resolve } from "node:path";
import type { FileReader } from "../../../../kernel/ports/file-reader.js";
import type { FileWriter } from "../../../../kernel/ports/file-writer.js";
import type { Hasher } from "../../../../kernel/ports/hasher.js";
import type { Logger } from "../../../../kernel/ports/logger.js";
import type { VersionReader } from "../../../../kernel/ports/version-reader.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import { projectHooksDeliveryOf } from "../../../tools/domain/registry.js";
import type { FrameworkBuildTarget } from "../../../translate/domain/build-target.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { MarketplaceSyncSettings } from "../flows/marketplace-sync-settings-use-case.js";
import type { InstallRuntimeConfigUseCase } from "../install/install-runtime-config-use-case.js";
import { assertNoSymlinksWithinRoot } from "../ownership/project-path-boundary.js";
import { PluginAddUseCase } from "../plugin/plugin-add-use-case.js";
import type {
  EnsureBuiltMarketplace,
  EnsureBuiltMarketplaceResult,
} from "../shared/ensure-built-marketplace-use-case.js";
import { protectUpgradeWrites } from "../upgrade-file-guard.js";
import type {
  FrameworkReleaseInput,
  FrameworkReleasePlan,
  FrameworkUpgradeTarget,
} from "./framework-release-plan.js";
import type { NativeReleaseImpact } from "./native-release-impact.js";

export interface PreparedBuild {
  readonly result: EnsureBuiltMarketplaceResult;
  readonly boundary: string;
  readonly files: readonly { path: string; content: string }[];
}

export interface FrameworkReleaseWriters {
  fs: FileReader & FileWriter;
  hasher: Hasher;
  logger: Logger;
  manifestRepo: ManifestRepository;
  userManifestRepo: ManifestRepository;
  marketplaceRegistry: MarketplaceRegistry;
  version: VersionReader;
  pluginRuntime: Pick<InstallRuntimeConfigUseCase, "ensurePluginRuntimeFiles">;
  sync: MarketplaceSyncSettings;
}

/** Applies a reviewed release without resolving its source or building it again. */
export class PreparedFrameworkRelease implements FrameworkReleasePlan {
  readonly impact;
  readonly shared;
  readonly tool;
  private readonly applied = new Set<string>();
  private readonly published = new Set<AiToolId>();

  constructor(
    private readonly release: {
      input: FrameworkReleaseInput;
      native: Awaited<ReturnType<NativeReleaseImpact["inspect"]>>;
      distributions: ReadonlyMap<string, PluginDistribution>;
      builds: ReadonlyMap<AiToolId, PreparedBuild>;
    },
    private readonly deps: FrameworkReleaseWriters
  ) {
    this.impact = release.native.impact;
    this.shared = release.native.shared;
    this.tool = release.native.tool;
  }

  async verifyImpact(): Promise<void> {
    await this.release.native.verify();
    for (const target of this.release.input.targets) {
      if (!this.applied.has(`${target.toolId}:${target.pluginName}`))
        await this.unchangedPlugin(target);
    }
  }

  async install(target: FrameworkUpgradeTarget): Promise<void> {
    const { marketplace, projectRoot: root } = this.release.input;
    const { fs, manifestRepo } = this.deps;
    if (marketplace.source.kind !== "github")
      throw new Error("Expected an official framework source.");
    const expectedSource = {
      kind: "git-subdir" as const,
      url: `https://github.com/${marketplace.source.repo}.git`,
      ref: marketplace.source.ref,
      path: `plugins/${target.pluginName}`,
      ...(marketplace.source.sha ? { sha: marketplace.source.sha } : {}),
    };
    const plugin = await this.unchangedPlugin(target);
    const tracked = new Map(plugin.files);
    for (const [path, hash] of plugin.projectHooks?.scripts ?? []) tracked.set(path, hash);
    const delivery = projectHooksDeliveryOf(target.toolId);
    if (delivery) {
      const path = resolve(root, delivery.relativePath);
      await assertNoSymlinksWithinRoot(fs, root, path);
      if (await fs.fileExists(path))
        tracked.set(delivery.relativePath, (await fs.readFileHash(path)).value);
    }
    const prepared = this.release.distributions.get(target.pluginName);
    if (!prepared || prepared.manifest.version !== target.targetVersion)
      throw new Error(`The prepared version of '${target.pluginName}' does not match the preview.`);
    const guardedAdd = new PluginAddUseCase(
      protectUpgradeWrites(fs, root, tracked),
      manifestRepo,
      { load: async () => prepared },
      this.deps.hasher,
      this.deps.logger,
      this.deps.marketplaceRegistry,
      this.preparedBuilder,
      this.deps.userManifestRepo,
      this.deps.pluginRuntime
    );
    await this.publish();
    await guardedAdd.execute({
      source: expectedSource,
      toolIds: [target.toolId],
      projectRoot: root,
      marketplace: marketplace.name,
      interactive: false,
      replace: true,
      requiredVersion: target.targetVersion,
      pluginMetadata: {
        name: target.pluginName,
        version: target.targetVersion,
        strict: prepared.manifest.strict ?? false,
      },
    });
    const result = await manifestRepo.load();
    const installed = result
      ?.getPlugins(target.toolId)
      .find((entry) => entry.name === target.pluginName);
    if (
      !result ||
      !installed ||
      installed.version !== target.targetVersion ||
      installed.source.kind !== "git-subdir" ||
      installed.source.url !== expectedSource.url ||
      installed.source.path !== expectedSource.path ||
      installed.source.ref !== expectedSource.ref
    )
      throw new Error(`Unable to verify the installed source for ${target.pluginName}.`);
    for (const [relativePath, expected] of plugin.files) {
      // A path claimed by any other tool or plugin remains theirs to manage.
      if (result.isFileTracked(relativePath)) continue;
      const path = resolve(root, relativePath);
      await assertNoSymlinksWithinRoot(fs, root, path);
      if (!(await fs.fileExists(path)) || (await fs.readFileHash(path)).value !== expected)
        throw new Error(`Cannot remove modified or missing file '${relativePath}'.`);
      await fs.deleteFile(path);
      if (await fs.fileExists(path))
        throw new Error(`Cannot remove obsolete file '${relativePath}'.`);
    }
    this.applied.add(`${target.toolId}:${target.pluginName}`);
  }

  sync() {
    const { projectRoot, targets, marketplace } = this.release.input;
    return this.deps.sync.execute({
      projectRoot,
      toolIds: [...new Set(targets.map((target) => target.toolId))],
      marketplaceNames: [marketplace.name],
      refreshOwnedPlugins: targets,
      approvedRefs: [...new Set(this.impact.map((entry) => entry.ref))],
      preparedBuilds: new Map<FrameworkBuildTarget, EnsureBuiltMarketplaceResult>(
        [...this.release.builds].map(([tool, build]) => [tool, build.result])
      ),
    });
  }

  private async unchangedPlugin(target: FrameworkUpgradeTarget) {
    const plugin = (await this.deps.manifestRepo.load())
      ?.getPlugins(target.toolId)
      .find((item) => item.name === target.pluginName);
    if (!plugin) throw new Error(`Plugin ${target.pluginName} disappeared before installation.`);
    const reviewed = this.release.input.manifest
      .getPlugins(target.toolId)
      .find((item) => item.name === target.pluginName);
    if (!reviewed || JSON.stringify(plugin.toJSON()) !== JSON.stringify(reviewed.toJSON()))
      throw new Error(
        `Plugin ${target.toolId}:${target.pluginName} changed after the preview; review the update again.`
      );
    return plugin;
  }

  private async publish(): Promise<void> {
    const { fs, version } = this.deps;
    for (const [tool, build] of this.release.builds) {
      if (this.published.has(tool)) continue;
      if (!(await fs.fileExists(build.boundary))) await fs.createDirectory(build.boundary);
      await assertNoSymlinksWithinRoot(fs, build.boundary, build.result.builtDir);
      // Same disposable cache as EnsureBuiltMarketplace; project files use guarded writers.
      await fs.deleteDirectory(build.result.builtDir);
      for (const file of build.files)
        await fs.writeFile(join(build.result.builtDir, file.path), file.content);
      await fs.writeFile(
        join(build.result.builtDir, ".build-version"),
        `${version.get()}:${this.release.input.catalog.version}`
      );
      this.published.add(tool);
    }
  }

  private readonly preparedBuilder: EnsureBuiltMarketplace = {
    execute: async (options) => {
      const prepared = this.release.builds.get(options.target as AiToolId);
      const { marketplace } = this.release.input;
      if (
        !prepared ||
        !this.published.has(options.target as AiToolId) ||
        options.marketplace.name !== marketplace.name ||
        JSON.stringify(options.marketplace.source) !== JSON.stringify(marketplace.source)
      )
        throw new Error("The prepared marketplace no longer matches the selected update.");
      return prepared.result;
    },
  };
}
