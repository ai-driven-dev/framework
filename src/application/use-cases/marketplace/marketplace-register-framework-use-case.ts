import { resolve } from "node:path";
import { isLocalPath } from "../../../domain/models/framework.js";
import { FRAMEWORK_MARKETPLACE_NAME, Marketplace } from "../../../domain/models/marketplace.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";

export interface MarketplaceRegisterFrameworkOptions {
  projectRoot: string;
  pathHint?: string;
}

export interface MarketplaceRegisterFrameworkResult {
  registered: boolean;
}

export class MarketplaceRegisterFrameworkUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly registry: MarketplaceRegistry
  ) {}

  async execute(
    options: MarketplaceRegisterFrameworkOptions
  ): Promise<MarketplaceRegisterFrameworkResult> {
    const list = await this.registry.list(options.projectRoot);
    if (list.some((m) => m.name === FRAMEWORK_MARKETPLACE_NAME)) {
      return { registered: false };
    }
    const source = await this.deriveSource(options.pathHint);
    if (source === null) return { registered: false };
    const marketplace = Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source,
      scope: "project",
      addedAt: new Date().toISOString(),
    });
    await this.registry.save(options.projectRoot, marketplace);
    return { registered: true };
  }

  private async deriveSource(pathHint: string | undefined): Promise<PluginSource | null> {
    const manifest = await this.manifestRepo.load();
    if (manifest?.repo) return { kind: "github", repo: manifest.repo };
    if (pathHint && isLocalPath(pathHint)) {
      return { kind: "local", path: resolve(pathHint) };
    }
    return null;
  }
}
