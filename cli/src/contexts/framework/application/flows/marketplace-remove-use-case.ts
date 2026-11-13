import {
  InvalidMarketplaceNameError,
  MarketplaceNotFoundError,
} from "../../../../kernel/errors.js";
import type { Prompter } from "../../../../kernel/ports/prompter.js";
import type { AiToolId, ToolId } from "../../../../kernel/tool.js";
import {
  FRAMEWORK_MARKETPLACE_NAME,
  type Marketplace,
} from "../../../distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../distribution/domain/ports/marketplace-registry.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { ProjectPluginCleanup } from "../ownership/project-plugin-cleanup.js";

export interface MarketplaceRemoveOptions {
  name: string;
  tools: ToolCatalog;
  projectRoot: string;
  autoConfirm: boolean;
  scope?: "project" | "user";
}

export interface MarketplaceRemoveResult {
  marketplace: Marketplace;
  removedPluginCount: number;
  orphanCount: number;
}

interface OrphanRef {
  toolId: AiToolId;
  plugin: InstalledPlugin;
}

export class MarketplaceRemoveUseCase {
  constructor(
    private readonly cleanup: ProjectPluginCleanup,
    private readonly manifestRepo: ManifestRepository,
    private readonly registry: MarketplaceRegistry,
    private readonly prompter: Prompter
  ) {}

  async execute(options: MarketplaceRemoveOptions): Promise<MarketplaceRemoveResult> {
    // Machine-scope, shared by every project on this machine: removing it here would orphan the
    // host's own registration for every other project, with no confirmation and no way back short
    // of `aidd setup` running again. It is removed with the framework itself, by `aidd clean`.
    if (options.name === FRAMEWORK_MARKETPLACE_NAME) {
      throw new InvalidMarketplaceNameError(
        `"${FRAMEWORK_MARKETPLACE_NAME}" is shared by every project on this machine and is not removed with \`aidd marketplace remove\` — it is removed with the framework itself, by \`aidd clean\`, once machine scope lands there.`
      );
    }
    if (options.scope === "user")
      throw new Error("User-scope marketplace removal requires UserMarketplaceRemoveUseCase.");
    const marketplace = await this.findOrThrow(options.projectRoot, options.name, "project");
    const manifest = await this.manifestRepo.load();
    const orphans = manifest ? this.collectOrphans(manifest, options.name, options.tools) : [];
    const nativeRefs = new Map<ToolId, readonly string[]>();
    if (manifest !== null) {
      for (const { toolId, plugin } of orphans) {
        const hostName = manifest
          .getNativeRegistrations(toolId)
          ?.marketplaces.find((m) => m.alias === plugin.marketplace)?.hostName;
        if (hostName !== undefined)
          nativeRefs.set(toolId, [...(nativeRefs.get(toolId) ?? []), `${plugin.name}@${hostName}`]);
      }
    }
    const cleanup = await this.shouldCleanup(orphans.length, options.autoConfirm);
    let removed = 0;
    if (cleanup && manifest) {
      removed = await this.removeOrphans(manifest, orphans, options.tools, options.projectRoot);
    }
    await this.registry.delete(options.projectRoot, marketplace.name, marketplace.scope);
    if (cleanup) {
      await this.cleanup.detachClaims(options.projectRoot, nativeRefs, orphans);
    }
    return { marketplace, removedPluginCount: removed, orphanCount: orphans.length };
  }

  private async findOrThrow(
    projectRoot: string,
    name: string,
    scope: "project" | "user"
  ): Promise<Marketplace> {
    const list = await this.registry.list(projectRoot);
    const found = list.find((m) => m.name === name && m.scope === scope);
    if (!found) throw new MarketplaceNotFoundError(name);
    return found;
  }

  private collectOrphans(
    manifest: Manifest,
    marketplaceName: string,
    tools: ToolCatalog
  ): OrphanRef[] {
    const orphans: OrphanRef[] = [];
    for (const toolId of tools.aiIdsInCanonicalOrder()) {
      for (const plugin of manifest.getPlugins(toolId)) {
        if (plugin.marketplace === marketplaceName) orphans.push({ toolId, plugin });
      }
    }
    return orphans;
  }

  private async shouldCleanup(count: number, autoConfirm: boolean): Promise<boolean> {
    if (count === 0) return false;
    if (autoConfirm) return true;
    return this.prompter.confirm(`Remove ${count} plugin(s) installed from this marketplace?`);
  }

  private async removeOrphans(
    manifest: Manifest,
    orphans: readonly OrphanRef[],
    tools: ToolCatalog,
    projectRoot: string
  ): Promise<number> {
    for (const { toolId, plugin } of orphans) {
      await this.cleanup.assertLocalIntegrationRemovable(
        tools.aiProfile(toolId),
        plugin,
        projectRoot
      );
    }
    for (const { toolId, plugin } of orphans) {
      const tool = tools.aiProfile(toolId);
      await this.cleanup.removeLocalIntegration(tool, plugin, projectRoot);
      await this.cleanup.deleteLocalFiles(tool, plugin, projectRoot);
      const registrations = manifest.getNativeRegistrations(toolId);
      const hostName = registrations?.marketplaces.find(
        (m) => m.alias === plugin.marketplace
      )?.hostName;
      if (registrations !== undefined && hostName !== undefined)
        manifest.setNativeRegistrations(toolId, {
          ...registrations,
          pluginRefs: registrations.pluginRefs.filter(
            (ref) => ref !== `${plugin.name}@${hostName}`
          ),
        });
      manifest.removePlugin(toolId, plugin.name);
    }
    await this.manifestRepo.save(manifest);
    return orphans.length;
  }
}
