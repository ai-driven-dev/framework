import { compareSemver, isSemver } from "../../../kernel/semver.js";
import type { PluginSource } from "../../../kernel/source.js";
import { type AiToolId, isAiToolId } from "../../../kernel/tool.js";
import { FRAMEWORK_MARKETPLACE_NAME, Marketplace } from "../../distribution/domain/marketplace.js";
import type { Manifest } from "../domain/manifest.js";
import {
  isOfficialReleasePluginSource,
  resolvePluginSourceFromMarketplace,
} from "../domain/plugins/plugin-source-resolver.js";
import type {
  FrameworkReleaseInput,
  FrameworkReleasePlan,
  FrameworkUpgradeTarget,
  NativeReleaseInstallation,
} from "./release/framework-release-plan.js";

interface FrameworkUpgradePreviewTarget extends FrameworkUpgradeTarget {
  readonly currentRef: string;
  readonly currentVersion: string;
  readonly targetVersion?: string;
}

export interface FrameworkUpgradePreview {
  readonly currentRef: string;
  readonly release: string;
  readonly title: string | null;
  readonly targets: readonly FrameworkUpgradePreviewTarget[];
  readonly globalSkipped: number;
  readonly unverifiedUserRefs: number;
  readonly globalPlugins: readonly {
    toolId: AiToolId;
    pluginName: string;
    currentVersion: string;
    source: PluginSource;
  }[];
  readonly shared: boolean;
  readonly impact: readonly NativeReleaseInstallation[];
}

interface UpgradeDeps {
  listMarketplaces(projectRoot: string): Promise<readonly Marketplace[]>;
  saveMarketplace(projectRoot: string, marketplace: Marketplace): Promise<void>;
  loadManifest(): Promise<Manifest | null>;
  loadUserManifest?(): Promise<Manifest | null>;
  resolvePublishedRelease(repo: string, release: string): Promise<{ title: string | null } | null>;
  resolveTarget(
    marketplace: Marketplace,
    projectRoot: string
  ): Promise<{
    catalog: {
      version?: string;
      plugins: readonly { name: string; source: PluginSource; version?: string }[];
    } | null;
    localPath: string;
  }>;
  readTargetVersion(localPath: string, pluginName: string): Promise<string>;
  preflight(input: FrameworkReleaseInput): Promise<FrameworkReleasePlan>;
}

export interface FrameworkUpgradeOptions {
  readonly projectRoot: string;
  readonly release: string;
  readonly allowShared: boolean;
  readonly confirm: (preview: FrameworkUpgradePreview) => Promise<boolean>;
}

/** Upgrades project-owned AIDD plugins without adding them to tools that never had them. */
export class UpgradeFrameworkUseCase {
  constructor(private readonly deps: UpgradeDeps) {}

  async execute(
    options: FrameworkUpgradeOptions
  ): Promise<{ updated: string[]; globalSkipped: number; cancelled: boolean }> {
    const { projectRoot, release, allowShared, confirm } = options;
    if (!release.startsWith("v") || !isSemver(release))
      throw new Error("A root release tag such as v5.13.0 is required.");
    const marketplace = (await this.deps.listMarketplaces(projectRoot)).find(
      (m) => m.name === FRAMEWORK_MARKETPLACE_NAME
    );
    if (!marketplace) throw new Error("The AIDD marketplace is not registered for this project.");
    const reviewedSource = JSON.stringify(marketplace.source);
    if (
      marketplace.source.kind !== "github" ||
      marketplace.source.repo !== "ai-driven-dev/framework"
    ) {
      throw new Error(
        "The AIDD marketplace source is local or unsupported; its release cannot be upgraded automatically."
      );
    }
    const currentRef = marketplace.source.ref;
    if (!currentRef?.startsWith("v") || !isSemver(currentRef)) {
      throw new Error(
        "The AIDD marketplace source is a branch or unversioned; its release cannot be upgraded automatically."
      );
    }
    if (compareSemver(release, currentRef) < 0)
      throw new Error("The selected release is older than the configured marketplace.");
    const manifest = await this.deps.loadManifest();
    if (!manifest)
      throw new Error("No project installation manifest exists; there is nothing to upgrade.");
    const targets: FrameworkUpgradePreviewTarget[] = [];
    let globalSkipped = 0;
    const userRefs: FrameworkUpgradeTarget[] = [];
    for (const id of manifest.getInstalledToolIds()) {
      if (!isAiToolId(id)) continue;
      for (const plugin of manifest.getPlugins(id)) {
        if (plugin.marketplace !== FRAMEWORK_MARKETPLACE_NAME) continue;
        if (plugin.scope === "user") {
          globalSkipped++;
          userRefs.push({ toolId: id, pluginName: plugin.name });
          continue;
        }
        const source = plugin.source;
        if (!isOfficialReleasePluginSource(source, plugin.name)) {
          throw new Error(
            `Cannot upgrade ${id}:${plugin.name}: its source is not a versioned official AIDD plugin.`
          );
        }
        if (compareSemver(source.ref, release) > 0)
          throw new Error(`Cannot downgrade ${id}:${plugin.name} from ${source.ref}.`);
        targets.push({
          toolId: id,
          pluginName: plugin.name,
          currentRef: source.ref,
          currentVersion: plugin.version,
        });
      }
    }
    if (targets.length === 0)
      throw new Error(
        "No project-scoped AIDD plugins found; global installations must be updated separately."
      );
    const publishedRelease = await this.deps.resolvePublishedRelease(
      marketplace.source.repo,
      release
    );
    if (!publishedRelease)
      throw new Error(`Release ${release} is not available from the configured source.`);
    const nextData = marketplace.toJSON();
    nextData.source = { ...marketplace.source, ref: release };
    if (release !== currentRef) delete nextData.source.sha;
    delete nextData.version;
    delete nextData.lastFetched;
    const next = Marketplace.fromJSON(nextData);
    const { catalog, localPath } = await this.deps.resolveTarget(next, projectRoot);
    if (
      !catalog?.version ||
      !isSemver(catalog.version) ||
      compareSemver(catalog.version, release) !== 0
    ) {
      throw new Error(
        `Release ${release} does not contain the expected versioned AIDD marketplace.`
      );
    }
    const names = new Set(catalog.plugins.map((plugin) => plugin.name));
    const missing = targets.filter((target) => !names.has(target.pluginName));
    if (missing.length)
      throw new Error(
        `Release ${release} is missing installed plugins: ${missing.map((x) => x.pluginName).join(", ")}.`
      );
    const versions = new Map<string, string>();
    const previewTargets: FrameworkUpgradePreviewTarget[] = [];
    for (const target of targets) {
      const entry = catalog.plugins.find((plugin) => plugin.name === target.pluginName);
      if (!entry) throw new Error(`Cannot verify source of ${target.pluginName}.`);
      const resolved = resolvePluginSourceFromMarketplace(entry.source, next, localPath);
      if (!isOfficialReleasePluginSource(resolved, target.pluginName) || resolved.ref !== release)
        throw new Error(`Cannot verify source of ${target.pluginName} in ${release}.`);
      let targetVersion = versions.get(target.pluginName);
      if (targetVersion === undefined) {
        targetVersion = await this.deps.readTargetVersion(localPath, target.pluginName);
        if (!isSemver(targetVersion))
          throw new Error(`Cannot verify the target version of ${target.pluginName}.`);
        versions.set(target.pluginName, targetVersion);
      }
      if (entry.version && entry.version !== targetVersion)
        throw new Error(`The catalog version of ${target.pluginName} does not match its manifest.`);
      if (
        !isSemver(target.currentVersion) ||
        compareSemver(targetVersion, target.currentVersion) < 0
      )
        throw new Error(
          `Cannot downgrade ${target.toolId}:${target.pluginName} from ${target.currentVersion} to ${targetVersion}.`
        );
      previewTargets.push({ ...target, targetVersion });
    }
    const preflight = await this.deps.preflight({
      manifest,
      projectRoot,
      targets: previewTargets,
      marketplace: next,
      localPath,
      catalog,
    });
    const userManifest = await this.deps.loadUserManifest?.();
    const globalPlugins = (userManifest?.getInstalledToolIds() ?? []).flatMap((toolId) =>
      !isAiToolId(toolId)
        ? []
        : (userManifest?.getPlugins(toolId) ?? [])
            .filter(
              (plugin) =>
                plugin.scope === "user" &&
                (plugin.marketplace === FRAMEWORK_MARKETPLACE_NAME ||
                  (plugin.marketplace === undefined &&
                    plugin.source.kind === "git-subdir" &&
                    plugin.source.url === "https://github.com/ai-driven-dev/framework.git" &&
                    plugin.source.path === `plugins/${plugin.name}`))
            )
            .map((plugin) => ({
              toolId,
              pluginName: plugin.name,
              currentVersion: plugin.version,
              source: plugin.source,
            }))
    );
    const unverifiedUserRefs = userRefs.filter(
      (ref) =>
        !globalPlugins.some(
          (entry) => entry.toolId === ref.toolId && entry.pluginName === ref.pluginName
        )
    ).length;
    const impact = preflight.impact;
    const shared = marketplace.scope === "user" || preflight.shared;
    if (
      !(await confirm({
        currentRef,
        release,
        title: publishedRelease.title,
        targets: previewTargets,
        globalSkipped,
        unverifiedUserRefs,
        globalPlugins,
        shared,
        impact,
      }))
    ) {
      return { updated: [], globalSkipped, cancelled: true };
    }
    if (shared && !allowShared) {
      throw new Error(
        "The AIDD marketplace is shared with other projects; pass --allow-shared after reviewing the impact."
      );
    }
    await preflight.verifyImpact();
    const currentMarketplace = (await this.deps.listMarketplaces(projectRoot)).find(
      (entry) => entry.name === FRAMEWORK_MARKETPLACE_NAME
    );
    if (
      !currentMarketplace ||
      currentMarketplace.scope !== marketplace.scope ||
      JSON.stringify(currentMarketplace.source) !== reviewedSource
    )
      throw new Error("The AIDD marketplace changed after the preview; review the update again.");
    nextData.version = catalog.version;
    await this.deps.saveMarketplace(projectRoot, Marketplace.fromJSON(nextData));
    const updated: string[] = [];
    let nativeChecked = false;
    try {
      for (const target of previewTargets) {
        if (target.toolId === preflight.tool && !nativeChecked) {
          await preflight.verifyImpact();
          nativeChecked = true;
        }
        if (target.targetVersion === undefined)
          throw new Error(`Cannot verify ${target.pluginName} version.`);
        await preflight.install(target);
        const installed = (await this.deps.loadManifest())
          ?.getPlugins(target.toolId)
          .find((plugin) => plugin.name === target.pluginName);
        if (
          !installed ||
          installed.version !== target.targetVersion ||
          installed.scope !== "project" ||
          installed.marketplace !== FRAMEWORK_MARKETPLACE_NAME ||
          installed.source.kind !== "git-subdir" ||
          installed.source.url !== "https://github.com/ai-driven-dev/framework.git" ||
          installed.source.path !== `plugins/${target.pluginName}` ||
          installed.source.ref !== release
        ) {
          throw new Error(
            `Unable to verify the installed source for ${target.toolId}:${target.pluginName}.`
          );
        }
        updated.push(`${target.toolId}:${target.pluginName}`);
      }
      const activation = await preflight.sync();
      if (
        activation.errors.length ||
        activation.binaryMissing.length ||
        activation.warnings.length
      ) {
        const problems = [
          ...activation.warnings,
          ...activation.errors.map((error) => `${error.scope}: ${error.message}`),
          ...activation.binaryMissing.map(
            (error) => `${error.toolId}: ${error.binary} is unavailable`
          ),
        ];
        throw new Error(problems.join("; "));
      }
    } catch (error) {
      throw new Error(
        `Upgrade incomplete after the shared marketplace changed to ${release}. Plugin sources updated: ${updated.join(", ") || "none"}. ${error instanceof Error ? error.message : String(error)}`
      );
    }
    return { updated, globalSkipped, cancelled: false };
  }
}
