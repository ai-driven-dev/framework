import type { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { MarketplaceRegistry } from "../../../src/contexts/distribution/ports/marketplace-registry.js";
import type { MarketplaceScope } from "../../../src/shared/domain/scope.js";

export class InMemoryMarketplaceRegistry implements MarketplaceRegistry {
  private readonly project = new Map<string, Marketplace>();
  private readonly user = new Map<string, Marketplace>();

  async list(projectRoot: string): Promise<readonly Marketplace[]> {
    const projectEntries = this.getProjectEntries(projectRoot);
    const seen = new Set(projectEntries.map((m) => m.name));
    const userFiltered = [...this.user.values()].filter((m) => !seen.has(m.name));
    return [...projectEntries, ...userFiltered];
  }

  async save(projectRoot: string, marketplace: Marketplace): Promise<void> {
    const store = marketplace.scope === "project" ? this.project : this.user;
    store.set(this.key(projectRoot, marketplace.name, marketplace.scope), marketplace);
  }

  async delete(projectRoot: string, name: string, scope: MarketplaceScope): Promise<void> {
    const store = scope === "project" ? this.project : this.user;
    store.delete(this.key(projectRoot, name, scope));
  }

  async updateLastFetched(
    projectRoot: string,
    name: string,
    scope: MarketplaceScope,
    when: string
  ): Promise<void> {
    const store = scope === "project" ? this.project : this.user;
    const key = this.key(projectRoot, name, scope);
    const existing = store.get(key);
    if (existing !== undefined) {
      store.set(key, existing.withLastFetched(when));
    }
  }

  async updateVersion(
    projectRoot: string,
    name: string,
    scope: MarketplaceScope,
    version: string
  ): Promise<void> {
    const store = scope === "project" ? this.project : this.user;
    const key = this.key(projectRoot, name, scope);
    const existing = store.get(key);
    if (existing !== undefined) {
      store.set(key, existing.withVersion(version));
    }
  }

  getAll(projectRoot: string): readonly Marketplace[] {
    return [...this.getProjectEntries(projectRoot), ...this.user.values()];
  }

  private getProjectEntries(projectRoot: string): Marketplace[] {
    const prefix = `${projectRoot}:`;
    return [...this.project.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
  }

  /** A user entry is the machine's, so it is named alone; a project entry is the project's. */
  private key(projectRoot: string, name: string, scope: MarketplaceScope): string {
    return scope === "user" ? name : `${projectRoot}:${name}`;
  }
}
