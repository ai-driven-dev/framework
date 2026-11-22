import type { HostPluginRegistryReading } from "../../domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../ports/host-plugin-registry.js";
import { readPluginRegistryFile } from "./plugin-registry-file.js";

/**
 * A host registry kept as an `enabledPlugins` map in a settings file, keyed on the same
 * `<plugin>@<marketplace>` ref as every other host and carrying a boolean. No project binding,
 * so like the TOML layout it answers for the machine and cannot answer for one project.
 */
export class EnabledPluginsMapReader implements HostPluginRegistry {
  constructor(private readonly path: string) {}

  read(_projectRoot: string): Promise<HostPluginRegistryReading> {
    return readPluginRegistryFile(this.path, (content) => {
      const enabled: unknown = Object(JSON.parse(content)).enabledPlugins;
      // Absent is a real answer here, unlike a file that would not open: the host writes the
      // key on its first install, so a settings file without one carries no plugin.
      return {
        location: this.path,
        refs: new Map(
          Object.entries(typeof enabled === "object" && enabled !== null ? enabled : {}).map(
            ([ref, on]) => [ref, { enabled: on !== false }]
          )
        ),
      };
    });
  }
}
