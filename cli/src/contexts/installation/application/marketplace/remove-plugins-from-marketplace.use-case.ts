import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { PluginClaims } from "../../contract/records/plugin-claims.js";
import type { ToolRecords } from "../../contract/records/scope-records.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { ProjectIntegrationCleanup } from "../../ports/project-integration-cleanup.js";
import type { InstallationCatalog } from "../../ports/tool-sections.js";
import type { RecordedPluginRef } from "../removal/project-plugin-withdrawal.js";

export interface RemovePluginsFromMarketplaceRequest {
  marketplace: string;
  projectRoot: string;
  /** Asked once, with how many plugins came from the marketplace, and only when there are some. */
  confirm: (orphanCount: number) => Promise<boolean>;
  records: RecordedPluginRef;
}

export interface RemovePluginsFromMarketplaceResult {
  orphanCount: number;
  removedCount: number;
  /** What the removed plugins left claimed, present only when they were removed. */
  claims?: PluginClaims;
}

interface OrphanRef {
  toolId: AiToolId;
  plugin: InstalledPlugin;
  recorded: RecordedPlugin;
}

/** What RemovePluginsFromMarketplace is built from. */
export interface RemovePluginsFromMarketplaceDeps {
  readonly manifestRepo: ManifestRepository;
  readonly cleanup: ProjectIntegrationCleanup;
}

/** Removes the plugins installed from one marketplace, once whoever asked has confirmed. */
export class RemovePluginsFromMarketplace {
  constructor(
    private readonly deps: RemovePluginsFromMarketplaceDeps,
    private readonly tools: InstallationCatalog
  ) {}

  async execute(
    command: RemovePluginsFromMarketplaceRequest
  ): Promise<RemovePluginsFromMarketplaceResult> {
    const manifest = await this.deps.manifestRepo.load();
    if (manifest === null) return { orphanCount: 0, removedCount: 0 };
    const registered = await command.records.loadRecords();
    const orphans = this.collectOrphans(manifest, command.marketplace);
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const { toolId, recorded } of orphans) {
      const registrations = registered.get(toolId);
      const ref = command.records.recordedRef(registrations, recorded);
      if (ref !== undefined) nativeRefs.set(toolId, [...(nativeRefs.get(toolId) ?? []), ref]);
    }
    if (orphans.length === 0 || !(await command.confirm(orphans.length))) {
      return { orphanCount: orphans.length, removedCount: 0 };
    }
    const removedCount = await this.removeOrphans({ manifest, registered }, orphans, command);
    return { orphanCount: orphans.length, removedCount, claims: { nativeRefs, plugins: orphans } };
  }

  private collectOrphans(manifest: Manifest, marketplaceName: string): OrphanRef[] {
    const orphans: OrphanRef[] = [];
    for (const toolId of this.tools.idsInCanonicalOrder("ai")) {
      for (const recorded of manifest.getRecordedPlugins(toolId)) {
        if (recorded.marketplace === marketplaceName)
          orphans.push({ toolId, plugin: recorded.plugin, recorded });
      }
    }
    return orphans;
  }

  private async removeOrphans(
    { manifest, registered }: { manifest: Manifest; registered: ToolRecords },
    orphans: readonly OrphanRef[],
    command: Pick<RemovePluginsFromMarketplaceRequest, "projectRoot" | "records">
  ): Promise<number> {
    const { records, projectRoot } = command;
    for (const { toolId, recorded } of orphans) {
      await this.deps.cleanup.assertLocalIntegrationRemovable(
        this.tools.aiProfile(toolId),
        recorded,
        projectRoot
      );
    }
    for (const { toolId, plugin, recorded } of orphans) {
      const tool = this.tools.aiProfile(toolId);
      await this.deps.cleanup.removeLocalIntegration({
        plugin: recorded,
        tool,
        projectRoot,
        manifest,
      });
      await this.deps.cleanup.deleteLocalFiles(tool, plugin, projectRoot);
      const registrations = registered.get(toolId);
      const ref = records.recordedRef(registrations, recorded);
      if (registrations !== undefined && ref !== undefined)
        registered.set(toolId, records.withoutRef(registrations, ref));
      manifest.removePlugin(toolId, plugin.name);
    }
    await records.saveRecords(registered);
    await this.deps.manifestRepo.save(manifest);
    return orphans.length;
  }
}
