import type { HostMarketplaceRegistryReading } from "../domain/marketplace-registry-reading.js";

export interface HostMarketplaceRegistry {
  read(): Promise<HostMarketplaceRegistryReading>;
}
