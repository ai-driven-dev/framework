import type {
  HostPluginRegistry,
  HostPluginRegistryReading,
} from "../../../../src/contexts/host-registration/contract/host-plugin-registry.js";

/** A registry double whose answer is fixed at construction — never a real file, never a
 * real binary. Stands in for whichever host a doctor or telemetry test needs to ask. */
export class FakeHostPluginRegistry implements HostPluginRegistry {
  constructor(private readonly reading: HostPluginRegistryReading) {}

  async read(): Promise<HostPluginRegistryReading> {
    return this.reading;
  }
}
