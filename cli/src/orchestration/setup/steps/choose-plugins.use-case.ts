import type { ListMarketplaces } from "../../../contexts/distribution/application/list-marketplaces.use-case.js";
import type { ResolveMarketplace } from "../../../contexts/distribution/application/resolve-marketplace.use-case.js";
import type { PluginCatalogEntry } from "../../../contexts/distribution/contract/catalog.js";
import type { PluginInstallFromMarketplace } from "../../plugin/install-from-marketplace.use-case.js";
import type { PluginPick } from "../../plugin/pick-plugins.use-case.js";
import type { PluginInstallMode } from "../setup-flow.js";
export interface ChoosePluginsRequest {
  projectRoot: string;
  mode: PluginInstallMode;
  pluginNames: readonly string[];
  interactive: boolean;
}

export interface ChoosePluginsResult {
  installed: readonly string[];
}

export interface ChoosePluginsDeps {
  readonly pickPlugins: PluginPick;
  readonly pluginInstallFromMarketplaceUseCase: PluginInstallFromMarketplace;
  readonly listMarketplaces: Pick<ListMarketplaces, "execute">;
  readonly resolveMarketplaceUseCase: Pick<ResolveMarketplace, "execute">;
}

export class ChoosePlugins {
  constructor(private readonly deps: ChoosePluginsDeps) {}

  async execute(options: ChoosePluginsRequest): Promise<ChoosePluginsResult> {
    if (options.mode === "none") return { installed: [] };
    if (options.mode === "interactive") return this.runInteractive(options);
    return this.runScripted(options);
  }

  private async runInteractive(options: ChoosePluginsRequest): Promise<ChoosePluginsResult> {
    if (!options.interactive) return { installed: [] };
    const result = await this.deps.pickPlugins.execute({
      toolIds: "all",
      projectRoot: options.projectRoot,
      interactive: true,
    });
    return { installed: result.installed };
  }

  private async runScripted(options: ChoosePluginsRequest): Promise<ChoosePluginsResult> {
    const names = await this.resolveScriptedNames(options);
    const installed: string[] = [];
    for (const name of names) {
      await this.deps.pluginInstallFromMarketplaceUseCase.execute({
        pluginName: name,
        toolIds: "all",
        projectRoot: options.projectRoot,
        interactive: options.interactive,
        autoSelect: true,
        replace: true,
      });
      installed.push(name);
    }
    return { installed };
  }

  private async resolveScriptedNames(options: ChoosePluginsRequest): Promise<readonly string[]> {
    if (options.mode === "named") return options.pluginNames;
    const entries = await this.loadCatalogEntries(options.projectRoot);
    if (options.mode === "recommended")
      return entries.filter((e) => e.recommended).map((e) => e.name);
    return entries.map((e) => e.name);
  }

  private async loadCatalogEntries(projectRoot: string): Promise<readonly PluginCatalogEntry[]> {
    const { marketplaces } = await this.deps.listMarketplaces.execute({ projectRoot });
    const entries: PluginCatalogEntry[] = [];
    for (const marketplace of marketplaces) {
      const { catalog } = await this.deps.resolveMarketplaceUseCase.execute({
        marketplace,
        projectRoot,
      });
      if (catalog) entries.push(...catalog.plugins);
    }
    return entries;
  }
}
