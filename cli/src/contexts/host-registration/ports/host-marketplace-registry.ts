import type { HostMarketplaceRegistryReading } from "../domain/reading/marketplace-registry-reading.js";

export interface HostMarketplaceRegistry {
  read(): Promise<HostMarketplaceRegistryReading>;
}
