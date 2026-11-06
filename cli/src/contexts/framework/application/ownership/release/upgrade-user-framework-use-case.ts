import type { Logger } from "../../../../../kernel/ports/logger.js";
import { compareSemver, isSemver } from "../../../../../kernel/semver.js";
import { type AiToolId, isAiToolId } from "../../../../../kernel/tool.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "../../../../distribution/domain/marketplace.js";
import { frameworkBuildModeFor, globalFilesOf } from "../../../../tools/domain/registry.js";
import { Manifest } from "../../../domain/manifest.js";
import { InstalledPlugin } from "../../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { UserPluginFileUpdater } from "../user-plugin-file-updater.js";
import type { PinnedUserFramework } from "./pinned-user-framework.js";
import type { UserReleaseJournal } from "./user-release-journal.js";

export interface UserReleasePreview {
  readonly release: string;
  readonly title: string | null;
  readonly targets: readonly {
    toolId: AiToolId;
    name: string;
    currentRef: string;
    currentVersion: string;
    targetVersion: string;
    dependents: readonly string[];
  }[];
  readonly nativeSkipped: number;
}

/** Updates the individually owned flat copies, without moving a shared marketplace or native claim. */
export class UpgradeUserFrameworkUseCase {
  constructor(
    private readonly deps: {
      repo: ManifestRepository;
      builder: PinnedUserFramework;
      updater: UserPluginFileUpdater;
      journal: UserReleaseJournal;
      logger: Logger;
      resolvePublishedRelease: (
        repo: string,
        release: string
      ) => Promise<{ title: string | null } | null>;
    }
  ) {}

  async execute(options: {
    projectRoot: string;
    release: string;
    confirm: (preview: UserReleasePreview) => Promise<boolean>;
  }): Promise<{ updated: string[]; nativeSkipped: number; cancelled: boolean }> {
    const run = () => {
      const builder = this.deps.builder;
      return builder.withSession
        ? builder.withSession((session) => this.executeLocked(options, session))
        : this.executeLocked(options, builder);
    };
    return this.deps.repo.withExclusiveAccess ? this.deps.repo.withExclusiveAccess(run) : run();
  }

  private async executeLocked(
    options: {
      projectRoot: string;
      release: string;
      confirm: (preview: UserReleasePreview) => Promise<boolean>;
    },
    builder: PinnedUserFramework
  ): Promise<{ updated: string[]; nativeSkipped: number; cancelled: boolean }> {
    const { release, projectRoot, confirm } = options;
    if (!release.startsWith("v") || !isSemver(release))
      throw new Error("A root release tag such as v5.13.0 is required.");
    const loaded = await this.deps.repo.load();
    if (!loaded) throw new Error("No machine installation manifest exists.");
    let manifest = Manifest.fromJSON(loaded.toJSON());
    const publishedRelease = await this.deps.resolvePublishedRelease(
      "ai-driven-dev/framework",
      release
    );
    if (!publishedRelease)
      throw new Error(`Release ${release} is not available from the official source.`);
    const nativeSkipped = manifest
      .getInstalledToolIds()
      .reduce(
        (total, tool) =>
          total +
          (isAiToolId(tool)
            ? (manifest.getNativeRegistrations(tool)?.pluginClaims ?? []).filter((claim) =>
                claim.ref.endsWith(`@${FRAMEWORK_MARKETPLACE_NAME}`)
              ).length
            : 0),
        0
      );
    const targets = manifest.getInstalledToolIds().flatMap((toolId) => {
      if (!isAiToolId(toolId) || !globalFilesOf(toolId) || frameworkBuildModeFor(toolId) !== "flat")
        return [];
      return manifest
        .getPlugins(toolId)
        .filter(
          (plugin) => plugin.scope === "user" && plugin.marketplace === FRAMEWORK_MARKETPLACE_NAME
        )
        .map((plugin) => ({ toolId, plugin }));
    });
    if (targets.length === 0)
      throw new Error(
        "No flat machine-scoped AIDD plugins found; native installations need their owning tool."
      );
    const plans = [];
    let sha: string | undefined;
    for (const { toolId, plugin } of targets) {
      const source = plugin.source;
      if (plugin.mcpEntries.size || plugin.projectHooks !== undefined || plugin.componentPaths.size)
        throw new Error(
          `${toolId}:${plugin.name}: machine ownership includes unsupported contributions; update refused.`
        );
      if (
        source.kind !== "git-subdir" ||
        source.url !== "https://github.com/ai-driven-dev/framework.git" ||
        source.path !== `plugins/${plugin.name}` ||
        !source.ref ||
        !source.ref.startsWith("v") ||
        !isSemver(source.ref)
      )
        throw new Error(
          `${toolId}:${plugin.name}: current source is not a pinned official release.`
        );
      if (compareSemver(release, source.ref) < 0)
        throw new Error(`${toolId}:${plugin.name}: refusing a release downgrade.`);
      const prepared = await builder.build(release, toolId, plugin.name, sha);
      sha ??= prepared.sha;
      if (compareSemver(prepared.dist.manifest.version, plugin.version) < 0)
        throw new Error(`${toolId}:${plugin.name}: refusing a plugin downgrade.`);
      const candidate = InstalledPlugin.fromJSON({
        ...plugin.toJSON(),
        source: { ...source, ref: release, sha: prepared.sha },
      });
      const plan = await this.deps.updater.planUpdate(
        candidate,
        toolId,
        projectRoot,
        this.deps.logger,
        true,
        prepared
      );
      if (!plan) throw new Error(`${toolId}:${plugin.name}: unable to plan machine update.`);
      if (JSON.stringify(plugin.tuiPlugin) !== JSON.stringify(plan.next.tuiPlugin))
        throw new Error(
          `${toolId}:${plugin.name}: release would change a shared TUI configuration; update refused.`
        );
      plans.push({ toolId, plugin, plan, currentRef: source.ref });
    }
    const preview: UserReleasePreview = {
      release,
      title: publishedRelease.title,
      nativeSkipped,
      targets: plans.map(({ toolId, plugin, plan, currentRef }) => ({
        toolId,
        name: plugin.name,
        currentRef,
        currentVersion: plugin.version,
        targetVersion: plan.next.version,
        dependents: plugin.dependents,
      })),
    };
    if (!(await confirm(preview))) return { updated: [], nativeSkipped, cancelled: true };
    const updated: string[] = [];
    for (const { toolId, plugin, plan } of plans) {
      const next = Manifest.fromJSON(manifest.toJSON());
      next.updatePlugin(toolId, plan.next);
      try {
        await this.deps.journal.commit(manifest, next, toolId, plugin.name, plan.files);
      } catch (error) {
        throw new Error(
          `Machine release update incomplete. Completed: ${updated.join(", ") || "none"}. Retry to recover.`,
          { cause: error }
        );
      }
      manifest = next;
      updated.push(`${toolId}:${plugin.name}`);
    }
    return { updated, nativeSkipped, cancelled: false };
  }
}
