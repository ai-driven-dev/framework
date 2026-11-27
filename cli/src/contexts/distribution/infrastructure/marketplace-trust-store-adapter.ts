import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { FileHash } from "../../../shared/domain/file-hash.js";
import { AIDD_DIR } from "../../../shared/domain/layout/aidd-layout.js";
import { type PluginSource, pluginSourceIdentity } from "../../../shared/domain/plugin/source.js";
import type { PrivateStorage } from "../../../shared/ports/private-storage.js";
import type { MarketplaceTrustStore } from "../ports/marketplace-trust-store.js";

const TRUST_STORE_FILENAME = "trusted-marketplaces.json";
const SCHEMA_VERSION = 1;

interface TrustStoreFile {
  version: number;
  trusted: string[];
}

export class MarketplaceTrustStoreAdapter implements MarketplaceTrustStore {
  constructor(private readonly storage: PrivateStorage) {}

  async isTrusted(projectRoot: string, source: PluginSource): Promise<boolean> {
    const trusted = await this.read(projectRoot);
    return trusted.includes(this.key(source));
  }

  async trust(projectRoot: string, source: PluginSource): Promise<void> {
    const trusted = await this.read(projectRoot);
    const key = this.key(source);
    if (trusted.includes(key)) return;
    trusted.push(key);
    await this.write(projectRoot, trusted);
  }

  // Identity hash, not a security token. Used only to compare sources.
  private key(source: PluginSource): string {
    return FileHash.of(pluginSourceIdentity(source)).value;
  }

  private path(projectRoot: string): string {
    return join(projectRoot, AIDD_DIR, "cache", TRUST_STORE_FILENAME);
  }

  private async read(projectRoot: string): Promise<string[]> {
    const raw = await this.storage.read(this.path(projectRoot));
    if (raw === undefined) return [];
    const parsed = JSON.parse(raw) as TrustStoreFile;
    return parsed.trusted;
  }

  private async write(projectRoot: string, trusted: readonly string[]): Promise<void> {
    const path = this.path(projectRoot);
    await mkdir(dirname(path), { recursive: true });
    const file: TrustStoreFile = { version: SCHEMA_VERSION, trusted: [...trusted] };
    await this.storage.replace(path, JSON.stringify(file, null, 2));
  }
}
