import type {
  HostMarketplaceRegistry,
  HostMarketplaceRegistryReading,
} from "../../../../src/contexts/host-registration/contract/host-marketplace-registry.js";

/** Stand-in for a host's own marketplace registry: one fixed reading unless a caller queues
 * several, each `read()` consuming the next and the last repeating forever. */
export class FakeHostMarketplaceRegistry implements HostMarketplaceRegistry {
  private readonly queue: HostMarketplaceRegistryReading[];
  reads = 0;

  constructor(...readings: readonly HostMarketplaceRegistryReading[]) {
    if (readings.length === 0) {
      throw new Error("FakeHostMarketplaceRegistry needs at least one reading");
    }
    this.queue = [...readings];
  }

  async read(): Promise<HostMarketplaceRegistryReading> {
    this.reads += 1;
    return this.queue.length > 1
      ? (this.queue.shift() as HostMarketplaceRegistryReading)
      : this.queue[0];
  }
}
