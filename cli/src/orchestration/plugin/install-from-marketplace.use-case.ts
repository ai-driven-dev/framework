import type { ResolvePluginSource } from "../../contexts/distribution/application/plugin-source/resolve-plugin-source.use-case.js";
import type { PluginCatalogEntry } from "../../contexts/distribution/contract/catalog.js";
import {
  catalogVersionRequirement,
  type RequestedVersionPolicy,
} from "../../contexts/distribution/contract/requested-version-policy.js";
import type { PluginAdd } from "../../contexts/installation/application/plugin/add/plugin-add.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { Logger } from "../../shared/ports/logger.js";
import type { Prompter } from "../ports/prompter.js";
import { askWhichMatch } from "../setup/plugin-questions.js";

export interface InstallFromMarketplaceRequest {
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

export interface InstallFromMarketplaceResult {
  marketplaceName: string;
  entry: PluginCatalogEntry;
}

export interface PluginInstallFromMarketplace {
  execute(options: InstallFromMarketplaceRequest): Promise<InstallFromMarketplaceResult>;
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

  async execute(options: InstallFromMarketplaceRequest): Promise<InstallFromMarketplaceResult> {
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
    const requiredVersion = this.requiredVersion(chosen.entry, options);
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

  private requiredVersion(
    entry: PluginCatalogEntry,
    options: InstallFromMarketplaceRequest
  ): string | undefined {
    const { requiredVersion, overridden } = catalogVersionRequirement(
      entry,
      options.version,
      options.requestedVersionPolicy ?? "strict"
    );
    if (overridden) {
      this.deps.logger?.info(
        `Plugin '${entry.name}': catalog version ${entry.version} differs from requested ${options.version}; using catalog version.`
      );
    }
    return requiredVersion;
  }
}
