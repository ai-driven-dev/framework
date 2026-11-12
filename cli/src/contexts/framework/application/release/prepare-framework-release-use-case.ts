import { dirname, join, relative, resolve } from "node:path";
import { builtMarketplaceDir, userBuiltMarketplaceDir } from "../../../../kernel/paths.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import { Marketplace } from "../../../distribution/domain/marketplace.js";
import { frameworkBuildModeFor, projectHooksDeliveryOf } from "../../../tools/domain/registry.js";
import type { PluginDistribution } from "../../../translate/domain/plugin-distribution.js";
import { getToolSupportedScope } from "../../domain/install-scope.js";
import type { PluginDistributionReader } from "../../domain/ports/plugin-distribution-reader.js";
import { BuiltTreeMaterializationTranslator } from "../framework/translator/built-tree-materialization-translator.js";
import { assertNoSymlinksWithinRoot } from "../ownership/project-path-boundary.js";
import {
  assertProjectMcpEntriesRemovable,
  assertProjectTuiUnchanged,
} from "../ownership/project-plugin-cleanup.js";
import type { DetectPluginDriftUseCase } from "../shared/detect-plugin-drift-use-case.js";
import {
  EnsureBuiltMarketplaceUseCase,
  type FrameworkBuildFor,
} from "../shared/ensure-built-marketplace-use-case.js";
import { assertProjectHooksRemovable } from "../shared/remove-project-hooks.js";
import { assertUpgradeWrite } from "../upgrade-file-guard.js";
import type {
  FrameworkReleaseInput,
  FrameworkReleasePlan,
  FrameworkUpgradeTarget,
} from "./framework-release-plan.js";
import type { NativeReleaseImpact } from "./native-release-impact.js";
import {
  type FrameworkReleaseWriters,
  type PreparedBuild,
  PreparedFrameworkRelease,
} from "./prepared-framework-release.js";

/** Validate every target and retain its built content before asking for approval. */
export class PrepareFrameworkReleaseUseCase {
  constructor(
    private readonly deps: FrameworkReleaseWriters & {
      reader: PluginDistributionReader;
      buildFor: FrameworkBuildFor;
      userCacheRoot: () => string;
      homedir: () => string;
      temporaryDirectory: () => Promise<string>;
      drift: DetectPluginDriftUseCase;
      impact: NativeReleaseImpact;
    }
  ) {}

  async execute(input: FrameworkReleaseInput): Promise<FrameworkReleasePlan> {
    const { projectRoot: root, targets, marketplace, localPath, catalog } = input;
    const { fs, hasher, marketplaceRegistry, buildFor, version, userCacheRoot, homedir } =
      this.deps;
    const impact = await this.deps.impact.inspect(input);
    await this.assertCurrent(input);
    const distributions = await this.readDistributions(input);
    const builds = new Map<AiToolId, PreparedBuild>();
    const temporary = await this.deps.temporaryDirectory();
    try {
      const previewMarketplace = Marketplace.fromJSON({
        ...marketplace.toJSON(),
        scope: "project",
      });
      const previewBuilder = new EnsureBuiltMarketplaceUseCase(
        fs,
        {
          execute: async ({ marketplace: selected }) => ({
            marketplace: selected,
            localPath,
            catalog: null,
          }),
        },
        buildFor,
        version,
        userCacheRoot
      );
      const reader = new BuiltTreeMaterializationTranslator(
        fs,
        hasher,
        homedir,
        previewBuilder,
        marketplaceRegistry
      );
      const planned = new Map<string, string>();
      for (const target of targets) {
        const dist = distributions.get(target.pluginName);
        if (!dist) throw new Error(`Missing prepared plugin '${target.pluginName}'.`);
        const { builtDir } = await previewBuilder.execute({
          projectRoot: temporary,
          marketplace: previewMarketplace,
          target: target.toolId,
          mode: frameworkBuildModeFor(target.toolId),
        });
        if (!builds.has(target.toolId)) {
          const boundary = resolve(marketplace.scope === "user" ? userCacheRoot() : root);
          const destination = resolve(
            marketplace.scope === "user"
              ? userBuiltMarketplaceDir(boundary, version.get(), marketplace.name, target.toolId)
              : builtMarketplaceDir(root, marketplace.name, target.toolId)
          );
          const files = [];
          for (const path of await fs.listFilesRecursive(builtDir)) {
            files.push({ path: relative(builtDir, path), content: await fs.readFile(path) });
          }
          builds.set(target.toolId, {
            boundary,
            files,
            result: { builtDir: destination, version: catalog.version, rebuilt: true },
          });
        }
        if (frameworkBuildModeFor(target.toolId) !== "flat") continue;
        await this.assertTargetFiles(
          input,
          target,
          dist,
          (await reader.readFlatFiles(builtDir, dist, target.toolId)).map(
            (file) => file.relativePath
          ),
          planned
        );
      }
    } finally {
      await fs.deleteDirectory(temporary);
    }
    return new PreparedFrameworkRelease(
      { input, native: impact, distributions, builds },
      this.deps
    );
  }

  private async assertCurrent({ manifest, projectRoot: root, targets }: FrameworkReleaseInput) {
    const { fs } = this.deps;
    for (const target of targets) {
      if (getToolSupportedScope(target.toolId) !== "project")
        throw new Error(
          `Cannot upgrade ${target.toolId}:${target.pluginName}: the tool's current install scope differs from the recorded project scope.`
        );
      const plugin = manifest
        .getPlugins(target.toolId)
        .find((entry) => entry.name === target.pluginName);
      if (!plugin)
        throw new Error(
          `Plugin ${target.toolId}:${target.pluginName} is missing from the manifest.`
        );
      for (const path of plugin.files.keys())
        await assertNoSymlinksWithinRoot(fs, root, resolve(root, path));
      for (const path of plugin.projectHooks?.scripts.keys() ?? [])
        await assertNoSymlinksWithinRoot(fs, root, resolve(root, path));
      const drift = await this.deps.drift.execute({
        manifest,
        projectRoot: root,
        toolIds: [target.toolId],
        pluginName: target.pluginName,
      });
      if (drift.length)
        throw new Error(
          `Cannot upgrade ${target.toolId}:${target.pluginName}: tracked files are modified or missing (${drift.flatMap((entry) => entry.files.map((file) => file.relativePath)).join(", ")}).`
        );
      await assertProjectMcpEntriesRemovable(fs, plugin, target.toolId, root);
      await assertProjectHooksRemovable(fs, plugin, target.toolId, root);
      await assertProjectTuiUnchanged(fs, plugin, target.toolId, root);
    }
  }

  private async readDistributions({ targets, localPath, catalog }: FrameworkReleaseInput) {
    const distributions = new Map<string, PluginDistribution>();
    for (const target of targets) {
      if (distributions.has(target.pluginName)) continue;
      const dist = await this.deps.reader.read(join(localPath, "plugins", target.pluginName));
      if (
        dist.manifest.name !== target.pluginName ||
        dist.manifest.version !== target.targetVersion
      )
        throw new Error(`The target version of '${target.pluginName}' changed during preparation.`);
      const entry = catalog.plugins.find((plugin) => plugin.name === target.pluginName);
      distributions.set(target.pluginName, dist.withStrict(entry?.strict ?? false));
    }
    return distributions;
  }

  private async assertTargetFiles(
    { manifest, projectRoot: root }: FrameworkReleaseInput,
    target: FrameworkUpgradeTarget,
    dist: PluginDistribution,
    paths: string[],
    planned: Map<string, string>
  ) {
    const { fs } = this.deps;
    const plugin = manifest
      .getPlugins(target.toolId)
      .find((entry) => entry.name === target.pluginName);
    if (!plugin) throw new Error(`Plugin ${target.pluginName} is missing from the manifest.`);
    const tracked = new Map([...plugin.files].map(([path, hash]) => [resolve(root, path), hash]));
    for (const [path, hash] of plugin.projectHooks?.scripts ?? [])
      tracked.set(resolve(root, path), hash);
    const delivery = projectHooksDeliveryOf(target.toolId);
    const hasProjectHooks = dist.components.hooks.some(
      (file) => file.relativePath === "hooks/hooks.json"
    );
    if (delivery && (hasProjectHooks || plugin.projectHooks !== undefined)) {
      const directories = new Set([dirname(resolve(root, delivery.relativePath))]);
      for (const file of dist.components.hooks) {
        if (hasProjectHooks && file.relativePath !== "hooks/hooks.json")
          directories.add(
            dirname(
              resolve(root, delivery.format.scriptPath(dist.manifest.name, file.relativePath))
            )
          );
      }
      for (const path of plugin.projectHooks?.scripts.keys() ?? [])
        directories.add(dirname(resolve(root, path)));
      for (let directory of directories) {
        if (!fs.entryExists || !fs.assertWritableDirectory)
          throw new Error("Cannot inspect the project hooks directory.");
        while (!(await fs.entryExists(directory)) && directory !== root)
          directory = dirname(directory);
        try {
          await fs.assertWritableDirectory(directory);
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "EACCES" && code !== "EPERM") throw error;
          throw new Error(
            `Cannot write project hooks directory '${directory}' (${code}); grant write access and retry before updating. In Codex CLI, restart with --add-dir pointing to this directory.`
          );
        }
      }
    }
    if (delivery && hasProjectHooks) {
      for (const file of dist.components.hooks) {
        if (file.relativePath !== "hooks/hooks.json")
          paths.push(delivery.format.scriptPath(dist.manifest.name, file.relativePath));
      }
    }
    for (const relativePath of paths) {
      const path = resolve(root, relativePath);
      const owner = `${target.toolId}:${target.pluginName}`;
      const shared = manifest
        .getInstalledToolIds()
        .some(
          (id) =>
            manifest.getToolFiles(id).some((entry) => entry.relativePath === relativePath) ||
            manifest.getMergeFiles(id).some((entry) => entry.relativePath === relativePath) ||
            manifest
              .getPlugins(id)
              .some(
                (entry) =>
                  (id !== target.toolId || entry.name !== target.pluginName) &&
                  entry.scope === "project" &&
                  (entry.files.has(relativePath) ||
                    entry.projectHooks?.scripts.has(relativePath) === true)
              )
        );
      if (shared)
        throw new Error(
          `Cannot upgrade ${owner}: target file '${relativePath}' is claimed by another installation.`
        );
      if (planned.has(path) && planned.get(path) !== owner)
        throw new Error(
          `Cannot upgrade ${owner}: target file '${relativePath}' is claimed by another plugin.`
        );
      planned.set(path, owner);
      await assertUpgradeWrite(fs, root, path, tracked);
    }
  }
}
