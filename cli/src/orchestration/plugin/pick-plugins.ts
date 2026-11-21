import type { ListMarketplaces } from "../../contexts/distribution/application/list-marketplaces.js";
import {
  marketplaceChoices,
  pluginChoices,
} from "../../contexts/distribution/application/plugin-source/plugin-choices.js";
import type { ResolveMarketplace } from "../../contexts/distribution/application/resolve-marketplace.js";
import type {
  PluginCatalog,
  PluginCatalogEntry,
} from "../../contexts/distribution/contract/catalog.js";
import type { MarketplaceView } from "../../contexts/distribution/contract/marketplace-view.js";
import type { PluginAdd } from "../../contexts/installation/application/plugin/add/plugin-add.js";
import { InvalidPluginManifestError } from "../../shared/domain/shared.error.js";
import type { AiToolId } from "../../shared/domain/tool.js";
import type { Prompter } from "../../shared/ports/prompter.js";
import { InteractiveOnlyError, NoMarketplacesRegisteredError } from "../orchestration.error.js";

export interface PickPluginsCommand {
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
}

export interface PickPluginsResult {
  marketplace: MarketplaceView;
  installed: readonly string[];
}

/** Picking a plugin interactively, as its callers need it: ask, get a choice back. */
export interface PluginPick {
  execute(options: PickPluginsCommand): Promise<PickPluginsResult>;
}

export class PickPlugins implements PluginPick {
  constructor(
    private readonly listMarketplaces: Pick<ListMarketplaces, "execute">,
    private readonly resolveMarketplace: Pick<ResolveMarketplace, "execute">,
    private readonly pluginAddUseCase: PluginAdd,
    private readonly prompter: Prompter
  ) {}

  async execute(options: PickPluginsCommand): Promise<PickPluginsResult> {
    if (!options.interactive) throw new InteractiveOnlyError("plugin install");
    const { marketplaces } = await this.listMarketplaces.execute({
      projectRoot: options.projectRoot,
    });
    if (marketplaces.length === 0) throw new NoMarketplacesRegisteredError();
    const marketplace = await this.chooseMarketplace(marketplaces);
    const catalog = await this.loadCatalog(marketplace, options.projectRoot);
    const selected = await this.chooseEntries(catalog.plugins);
    return this.installSelected(marketplace, selected, options);
  }

  private async chooseMarketplace(
    marketplaces: readonly MarketplaceView[]
  ): Promise<MarketplaceView> {
    const head = marketplaces[0];
    if (marketplaces.length === 1 && head !== undefined) return head;
    return this.prompter.select("Select a marketplace:", marketplaceChoices(marketplaces));
  }

  private async loadCatalog(
    marketplace: MarketplaceView,
    projectRoot: string
  ): Promise<PluginCatalog> {
    const { catalog, localPath } = await this.resolveMarketplace.execute({
      marketplace,
      projectRoot,
    });
    if (catalog === null) {
      throw new InvalidPluginManifestError(`marketplace.json not found at "${localPath}"`);
    }
    return catalog;
  }

  private async chooseEntries(
    entries: readonly PluginCatalogEntry[]
  ): Promise<readonly PluginCatalogEntry[]> {
    if (entries.length === 0) return [];
    return this.prompter.checkbox("Select plugins to install:", pluginChoices(entries));
  }

  private async installSelected(
    marketplace: MarketplaceView,
    entries: readonly PluginCatalogEntry[],
    options: PickPluginsCommand
  ): Promise<PickPluginsResult> {
    const installed: string[] = [];
    for (const entry of entries) {
      await this.pluginAddUseCase.execute({
        source: entry.source,
        toolIds: options.toolIds,
        projectRoot: options.projectRoot,
        interactive: options.interactive,
        marketplace: marketplace.name,
        githubMarketplace: marketplace.source.kind === "github",
        pluginMetadata: {
          name: entry.name,
          version: entry.version,
          strict: entry.strict ?? false,
        },
        replace: true,
      });
      installed.push(entry.name);
    }
    return { marketplace, installed };
  }
}
