import type {
  DeclaredMarketplace,
  InstallationMarketplaceRegistry,
} from "../../../../src/contexts/installation/ports/marketplace-sources.js";
import type { Scope } from "../../../../src/shared/domain/scope.js";

/** The marketplaces an installation reads, as each test declares them: a project's own, and the
 * machine's, named alone. */
export class FakeMarketplaceRegistry implements InstallationMarketplaceRegistry {
  private readonly project = new Map<string, DeclaredMarketplace>();
  private readonly user = new Map<string, DeclaredMarketplace>();

  seed(projectRoot: string, marketplace: DeclaredMarketplace): void {
    if (marketplace.scope === "user") this.user.set(marketplace.name, marketplace);
    else this.project.set(`${projectRoot}:${marketplace.name}`, marketplace);
  }

  async list(projectRoot: string): Promise<readonly DeclaredMarketplace[]> {
    const prefix = `${projectRoot}:`;
    const own = [...this.project.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, marketplace]) => marketplace);
    const shadowed = new Set(own.map((marketplace) => marketplace.name));
    return [...own, ...[...this.user.values()].filter(({ name }) => !shadowed.has(name))];
  }

  async delete(projectRoot: string, name: string, scope: Scope): Promise<void> {
    if (scope === "user") this.user.delete(name);
    else this.project.delete(`${projectRoot}:${name}`);
  }
}
