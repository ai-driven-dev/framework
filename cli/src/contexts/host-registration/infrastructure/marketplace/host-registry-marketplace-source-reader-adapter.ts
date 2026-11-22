import type { NativeMarketplaceSourceReading } from "../../domain/record/native-marketplace-source-reading.js";
import type { HostMarketplaceRegistry } from "../../ports/host-marketplace-registry.js";
import type { HostMarketplaceSources } from "../../ports/host-marketplace-sources.js";

export class HostRegistryMarketplaceSourceReaderAdapter implements HostMarketplaceSources {
  constructor(private readonly hostReader: HostMarketplaceRegistry) {}

  async read(_projectRoot: string): Promise<NativeMarketplaceSourceReading> {
    const reading = await this.hostReader.read();
    if (reading.entries !== undefined)
      return {
        location: reading.location,
        entries: new Map(
          [...reading.entries].map(([name, source]) => [
            name,
            { kind: "registry" as const, source },
          ])
        ),
      };
    if (reading.absent === true) return { location: reading.location, entries: new Map() };
    return {
      location: reading.location,
      unreadable: reading.unreadable ?? "Host marketplace registry is unreadable",
    };
  }
}
