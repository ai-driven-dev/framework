import type { HostPluginRegistryReading } from "../domain/reading/plugin-registry-reading.js";

export interface HostPluginRegistry {
  /** `projectRoot` because a registry may bind a ref to one project rather than to the machine
   *: Claude's does. A reader whose host records no such binding ignores it and says so, rather
   * than silently answering a narrower question than it was asked. */
  /** Never rejects: a failure is typed as `unreadable` on the reading. */
  read(projectRoot: string): Promise<HostPluginRegistryReading>;
}
