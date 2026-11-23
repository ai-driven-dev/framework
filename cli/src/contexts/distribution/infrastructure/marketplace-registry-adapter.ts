import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AIDD_DIR, AIDD_MARKETPLACES_FILENAME } from "../../../shared/domain/layout/aidd-layout.js";
import { asPlainObject } from "../../../shared/domain/reading/plain-object.js";
import type { Scope } from "../../../shared/domain/scope.js";
import type { AtomicWrite } from "../../../shared/ports/file-writer.js";
import { UnreadableMarketplaceRegistryError } from "../contract/distribution.error.js";
import { Marketplace, type MarketplaceData } from "../domain/marketplace.js";
import type { MarketplaceKey, MarketplaceRegistry } from "../ports/marketplace-registry.js";

const SCHEMA_VERSION = 1;

interface RegistryFile {
  version: number;
  marketplaces: MarketplaceData[];
}

/** A registry file that exists but cannot be read as one is never read as an empty
 * registry. `save()` reads this same list, appends to it and writes the whole file back, so
 * a silent empty read would not merely hide the marketplaces a person registered - it would
 * delete them on the very next write. A file that is simply absent is a different answer and
 * keeps its own: no file, no marketplaces, nothing to lose. */
function unreadable(path: string, reason: string): never {
  throw new UnreadableMarketplaceRegistryError(path, reason);
}

/** The registry's own list, or the reason the file cannot supply one. */
function registryEntries(raw: string, path: string): MarketplaceData[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    unreadable(path, error instanceof Error ? error.message : "it is not valid JSON");
  }
  const entries = asPlainObject(parsed)?.marketplaces;
  if (!Array.isArray(entries)) unreadable(path, "it carries no `marketplaces` list");
  return entries as MarketplaceData[];
}

export class MarketplaceRegistryAdapter implements MarketplaceRegistry {
  constructor(
    private readonly userConfigDir: () => string,
    private readonly writeFileAtomically: AtomicWrite
  ) {}

  async list(projectRoot: string): Promise<readonly Marketplace[]> {
    const project = await this.read(this.projectPath(projectRoot), "project");
    const user = await this.read(this.userPath(), "user");
    const seen = new Set(project.map((m) => m.name));
    const userFiltered = user.filter((m) => !seen.has(m.name));
    return [...project, ...userFiltered];
  }

  async save(projectRoot: string, marketplace: Marketplace): Promise<void> {
    await this.rewrite(projectRoot, marketplace.scope, (entries) => [
      ...entries.filter((m) => m.name !== marketplace.name),
      marketplace,
    ]);
  }

  async delete(projectRoot: string, name: string, scope: Scope): Promise<void> {
    await this.rewrite(projectRoot, scope, (entries) => entries.filter((m) => m.name !== name));
  }

  async updateLastFetched(projectRoot: string, key: MarketplaceKey, when: string): Promise<void> {
    await this.update(projectRoot, key, (m) => m.withLastFetched(when));
  }

  async updateVersion(projectRoot: string, key: MarketplaceKey, version: string): Promise<void> {
    await this.update(projectRoot, key, (m) => m.withVersion(version));
  }

  private async update(
    projectRoot: string,
    key: MarketplaceKey,
    change: (marketplace: Marketplace) => Marketplace
  ): Promise<void> {
    await this.rewrite(projectRoot, key.scope, (entries) =>
      entries.map((m) => (m.name === key.name ? change(m) : m))
    );
  }

  /** The scope's registry file, rewritten with what `edit` makes of the entries it holds. */
  private async rewrite(
    projectRoot: string,
    scope: Scope,
    edit: (entries: Marketplace[]) => Marketplace[]
  ): Promise<void> {
    const path = this.pathFor(projectRoot, scope);
    await this.write(path, edit(await this.read(path, scope)));
  }

  private pathFor(projectRoot: string, scope: Scope): string {
    return scope === "project" ? this.projectPath(projectRoot) : this.userPath();
  }

  private projectPath(projectRoot: string): string {
    return join(projectRoot, AIDD_DIR, AIDD_MARKETPLACES_FILENAME);
  }

  private userPath(): string {
    return join(this.userConfigDir(), AIDD_MARKETPLACES_FILENAME);
  }

  private async read(path: string, scope: Scope): Promise<Marketplace[]> {
    let raw: string;
    try {
      raw = await readFile(path, "utf-8");
    } catch {
      return [];
    }
    return registryEntries(raw, path).map((m) => Marketplace.fromJSON({ ...m, scope }));
  }

  private async write(path: string, entries: readonly Marketplace[]): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    const file: RegistryFile = {
      version: SCHEMA_VERSION,
      marketplaces: entries.map((m) => m.toJSON()),
    };
    await this.writeFileAtomically(path, JSON.stringify(file, null, 2));
  }
}
