import { Manifest } from "../../../domain/models/manifest.js";
import { FRAMEWORK_MARKETPLACE_NAME, Marketplace } from "../../../domain/models/marketplace.js";
import type { PluginSource } from "../../../domain/models/plugin-source.js";
import type { ManifestRepository } from "../../../domain/ports/manifest-repository.js";
import type { MarketplaceRegistry } from "../../../domain/ports/marketplace-registry.js";

export interface MarketplaceRegisterFrameworkOptions {
  projectRoot: string;
  force?: boolean;
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
    const alreadyRegistered = list.some((m) => m.name === FRAMEWORK_MARKETPLACE_NAME);
    if (alreadyRegistered && !options.force) return { registered: false };
    if (alreadyRegistered && options.force) {
      await this.registry.delete(options.projectRoot, FRAMEWORK_MARKETPLACE_NAME, "project");
    }
    const source = await this.deriveSource();
    const marketplace = Marketplace.create({
      name: FRAMEWORK_MARKETPLACE_NAME,
      source,
      scope: "project",
      addedAt: new Date().toISOString(),
    });
    await this.registry.save(options.projectRoot, marketplace);
    return { registered: true };
  }

  private async deriveSource(): Promise<PluginSource> {
    const manifest = await this.manifestRepo.load();
    const mode = manifest?.getMode() ?? "local";
    if (mode === "remote") {
      const repo = manifest?.repo ?? Manifest.DEFAULT_REPO;
      const version = manifest?.getScriptsVersion();
      const ref = version ? `v${version}` : undefined;
      return { kind: "github", repo, ref };
    }
    return { kind: "local", path: "." };
  }
}
