import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { PluginClaims } from "../../contract/plugin-claims.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type { ProjectIntegrationCleanup } from "../../ports/project-integration-cleanup.js";

export interface RemovePluginsFromMarketplaceCommand {
  marketplace: string;
  projectRoot: string;
  /** Asked once, with how many plugins came from the marketplace, and only when there are some. */
  confirm: (orphanCount: number) => Promise<boolean>;
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
}

/** Removes the plugins installed from one marketplace, once whoever asked has confirmed. */
export class RemovePluginsFromMarketplace {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly cleanup: ProjectIntegrationCleanup,
    private readonly records: RegistrationRecordRules,
    private readonly tools: ToolCatalog
  ) {}

  async execute(
    command: RemovePluginsFromMarketplaceCommand
  ): Promise<RemovePluginsFromMarketplaceResult> {
    const manifest = await this.manifestRepo.load();
    if (manifest === null) return { orphanCount: 0, removedCount: 0 };
    const orphans = this.collectOrphans(manifest, command.marketplace);
    const nativeRefs = new Map<ToolId, readonly string[]>();
    for (const { toolId, plugin } of orphans) {
      const registrations = manifest.getNativeRegistrations(toolId);
      const ref = this.records.refOf(registrations, plugin.name, command.marketplace);
      if (ref !== undefined) nativeRefs.set(toolId, [...(nativeRefs.get(toolId) ?? []), ref]);
    }
    if (orphans.length === 0 || !(await command.confirm(orphans.length))) {
      return { orphanCount: orphans.length, removedCount: 0 };
    }
    const removedCount = await this.removeOrphans(
      manifest,
      orphans,
      command.marketplace,
      command.projectRoot
    );
    return { orphanCount: orphans.length, removedCount, claims: { nativeRefs, plugins: orphans } };
  }

  private collectOrphans(manifest: Manifest, marketplaceName: string): OrphanRef[] {
    const orphans: OrphanRef[] = [];
    for (const toolId of this.tools.idsInCanonicalOrder("ai")) {
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.marketplace === marketplaceName) orphans.push({ toolId, plugin });
      }
    }
    return orphans;
  }

  private async removeOrphans(
    manifest: Manifest,
    orphans: readonly OrphanRef[],
    marketplace: string,
    projectRoot: string
  ): Promise<number> {
    for (const { toolId, plugin } of orphans) {
      await this.cleanup.assertLocalIntegrationRemovable(
        this.tools.aiProfile(toolId),
        plugin,
        projectRoot
      );
    }
    for (const { toolId, plugin } of orphans) {
      const tool = this.tools.aiProfile(toolId);
      await this.cleanup.removeLocalIntegration(tool, plugin, projectRoot);
      await this.cleanup.deleteLocalFiles(tool, plugin, projectRoot);
      const registrations = manifest.getNativeRegistrations(toolId);
      const ref = this.records.refOf(registrations, plugin.name, marketplace);
      if (registrations !== undefined && ref !== undefined)
        manifest.setNativeRegistrations(toolId, this.records.withoutRef(registrations, ref));
      manifest.removePlugin(toolId, plugin.name);
    }
    await this.manifestRepo.save(manifest);
    return orphans.length;
  }
}
