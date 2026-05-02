import {
  AmbiguousPluginMatchError,
  PluginNotInMarketplaceError,
  VersionMismatchError,
} from "../../../domain/errors.js";
import type { Marketplace } from "../../../domain/models/marketplace.js";
import type { PluginCatalogEntry } from "../../../domain/models/plugin-catalog.js";
import type { AiToolId } from "../../../domain/models/tool-ids.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";
import type { Prompter } from "../../../domain/ports/prompter.js";
import type { ResolveMarketplaceUseCase } from "../shared/resolve-marketplace-use-case.js";
import type { PluginAddUseCase } from "./plugin-add-use-case.js";

export interface PluginInstallFromMarketplaceOptions {
  pluginName: string;
  version?: string;
  fromMarketplace?: string;
  toolIds: AiToolId[] | "all";
  projectRoot: string;
  interactive: boolean;
  autoSelect?: boolean;
}

export interface PluginInstallFromMarketplaceResult {
  marketplace: Marketplace;
  entry: PluginCatalogEntry;
}

interface MatchEntry {
  marketplace: Marketplace;
  entry: PluginCatalogEntry;
}

export class PluginInstallFromMarketplaceUseCase {
  constructor(
    private readonly resolveMarketplace: ResolveMarketplaceUseCase,
    private readonly registry: MarketplaceRegistry,
    private readonly pluginAddUseCase: PluginAddUseCase,
    private readonly prompter: Prompter
  ) {}

  async execute(
    options: PluginInstallFromMarketplaceOptions
  ): Promise<PluginInstallFromMarketplaceResult> {
    const matches = await this.findMatches(options);
    const chosen = await this.chooseOne(matches, options);
    this.assertCatalogVersionMatches(chosen.entry, options.version);
    await this.pluginAddUseCase.execute({
      source: chosen.entry.source,
      toolIds: options.toolIds,
      projectRoot: options.projectRoot,
      interactive: options.interactive,
      marketplace: chosen.marketplace.name,
      requiredVersion: options.version,
    });
    return { marketplace: chosen.marketplace, entry: chosen.entry };
  }

  private async findMatches(options: PluginInstallFromMarketplaceOptions): Promise<MatchEntry[]> {
    const all = await this.registry.list(options.projectRoot);
    const filtered = options.fromMarketplace
      ? all.filter((m) => m.name === options.fromMarketplace)
      : all;
    const matches: MatchEntry[] = [];
    for (const m of filtered) {
      matches.push(...(await this.matchesIn(m, options)));
    }
    if (matches.length === 0) throw new PluginNotInMarketplaceError(options.pluginName);
    return matches;
  }

  private async matchesIn(
    m: Marketplace,
    options: PluginInstallFromMarketplaceOptions
  ): Promise<MatchEntry[]> {
    const { catalog } = await this.resolveMarketplace.execute({
      marketplace: m,
      projectRoot: options.projectRoot,
    });
    if (!catalog) return [];
    return catalog.plugins
      .filter((entry) => entry.name === options.pluginName)
      .map((entry) => ({ marketplace: m, entry }));
  }

  private async chooseOne(
    matches: MatchEntry[],
    options: PluginInstallFromMarketplaceOptions
  ): Promise<MatchEntry> {
    const head = matches[0];
    if (matches.length === 1 && head !== undefined) return head;
    if (options.autoSelect && head !== undefined) return head;
    if (!options.interactive) {
      throw new AmbiguousPluginMatchError(
        options.pluginName,
        matches.map((m) => m.marketplace.name)
      );
    }
    return this.prompter.select(
      `Multiple matches for '${options.pluginName}'. Select one:`,
      matches.map((m) => ({
        name: `${m.marketplace.name} — ${m.entry.version ?? "?"}`,
        value: m,
      }))
    );
  }

  // Catalog-level fast-fail. Plugin-level (plugin.json) check happens in PluginAddUseCase.
  private assertCatalogVersionMatches(
    entry: PluginCatalogEntry,
    requested: string | undefined
  ): void {
    if (!requested) return;
    if (entry.version && entry.version !== requested) {
      throw new VersionMismatchError(entry.name, requested, entry.version);
    }
  }
}
