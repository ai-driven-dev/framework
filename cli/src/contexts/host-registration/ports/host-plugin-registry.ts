import type { HostPluginRegistryReading } from "../domain/plugin-registry-reading.js";

export interface HostPluginRegistry {
  /** `projectRoot` because a registry may bind a ref to one project rather than to the machine
   * — Claude's does. A reader whose host records no such binding ignores it and says so, rather
   * than silently answering a narrower question than it was asked. */
  read(projectRoot: string): Promise<HostPluginRegistryReading>;
}
