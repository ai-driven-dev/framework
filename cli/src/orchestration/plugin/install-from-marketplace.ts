import type { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.js";
import type { PluginCatalogEntry } from "../../contexts/distribution/contract/catalog.js";
import type { RequestedVersionPolicy } from "../../contexts/distribution/contract/requested-version-policy.js";
import type { PluginAdd } from "../../contexts/installation/application/plugin/add/plugin-add.js";
import { VersionMismatchError } from "../../shared/domain/shared.error.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import { askWhichMatch } from "../setup/plugin-questions.js";

export interface PluginInstallFromMarketplaceOptions {
  pluginName: string;
  version?: string;
  fromMarketplace?: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  autoSelect?: boolean;
  /** When true, drop existing plugin entry before adding (idempotent setup re-runs). */
  replace?: boolean;
  requestedVersionPolicy?: RequestedVersionPolicy;
}

export interface PluginInstallFromMarketplaceResult {
  marketplaceName: string;
  entry: PluginCatalogEntry;
}

export interface PluginInstallFromMarketplace {
  execute(
    options: PluginInstallFromMarketplaceOptions
  ): Promise<PluginInstallFromMarketplaceResult>;
}

export interface InstallFromMarketplaceDeps {
  readonly resolvePluginSource: Pick<ResolvePluginSource, "execute">;
  readonly addPlugin: PluginAdd;
  readonly prompter: Prompter;
  readonly logger?: Logger;
}

/** Installs a plugin a registered marketplace catalogues, asking which one when several do. */
export class InstallFromMarketplace implements PluginInstallFromMarketplace {
  constructor(private readonly deps: InstallFromMarketplaceDeps) {}

  async execute(
    options: PluginInstallFromMarketplaceOptions
  ): Promise<PluginInstallFromMarketplaceResult> {
    const policy = options.requestedVersionPolicy ?? "strict";
    const matches = await this.deps.resolvePluginSource.execute({
      pluginName: options.pluginName,
      projectRoot: options.projectRoot,
      fromMarketplace: options.fromMarketplace,
    });
    const chosen = await askWhichMatch(this.deps.prompter, {
      pluginName: options.pluginName,
      matches,
      interactive: options.interactive,
      autoSelect: options.autoSelect ?? false,
    });
    const requiredVersion = this.assertOrCoerceCatalogVersion(
      chosen.entry,
      options.version,
      policy
    );
    await this.deps.addPlugin.execute({
      source: chosen.source,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
      marketplace: chosen.marketplaceName,
      githubMarketplace: chosen.githubMarketplace,
      requiredVersion,
      pluginMetadata: {
        name: chosen.entry.name,
        version: chosen.entry.version,
        strict: chosen.entry.strict,
      },
      replace: options.replace,
    });
    return { marketplaceName: chosen.marketplaceName, entry: chosen.entry };
  }

  // Catalog-level version check. Policy controls whether mismatch is fatal or silent.
  // Plugin-level (plugin.json) check happens in AddPlugin.
  private assertOrCoerceCatalogVersion(
    entry: PluginCatalogEntry,
    requested: string | undefined,
    policy: RequestedVersionPolicy
  ): string | undefined {
    if (policy === "prefer-catalog") {
      if (requested && entry.version && entry.version !== requested) {
        this.deps.logger?.info(
          `Plugin '${entry.name}': catalog version ${entry.version} differs from requested ${requested}; using catalog version.`
        );
      }
      // prefer-catalog always bypasses both the catalog-entry check (this site)
      // and the downstream plugin.json on-disk check in AddPlugin.
      return undefined;
    }
    if (!requested || !entry.version || entry.version === requested) return requested;
    throw new VersionMismatchError(entry.name, requested, entry.version);
  }
}
