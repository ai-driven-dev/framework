import type { ToolId } from "../../../../shared/domain/tool.js";
import type { RegisteredPlugin, RegisteredPlugins } from "../../contract/registered-plugins.js";
import type { RegistrationRecordRules } from "../../ports/native-host.js";
import type { InstallationScope } from "./installation-scope.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

export type ListRegisteredPluginsRequest = Pick<InstallationScope, "allowedIds">;

/**
 * The plugins each installed tool's host is expected to carry: the native registrations the
 * manifest recorded, falling back to the plugins it tracks, the state a `sync`-unaware installer
 * produced. Native registrations are already `<plugin>@<marketplace>` strings; the fallback
 * assembles the same shape.
 */
export class ListRegisteredPlugins {
  constructor(
    private readonly loadManifest: LoadManifest,
    private readonly records: RegistrationRecordRules
  ) {}

  async execute(command: ListRegisteredPluginsRequest): Promise<RegisteredPlugins> {
    const manifest = await this.loadManifest.execute();
    const tools: { toolId: ToolId; expectedPlugins: readonly RegisteredPlugin[] }[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (command.allowedIds && !command.allowedIds.has(toolId)) continue;
      const recorded = manifest.getNativeRegistrations(toolId);
      const expectedPlugins =
        recorded !== undefined
          ? this.records.pluginRefsOf(recorded).map((ref) => ({ plugin: ref, ref }))
          : manifest.getRecordedPlugins(toolId).map(({ plugin, marketplace }) => ({
              plugin: plugin.name,
              // Limit: with no recorded registration the fallback assumes the alias equals the host name.
              ref:
                marketplace === undefined
                  ? undefined
                  : this.records.refOnHostName(plugin.name, marketplace),
            }));
      tools.push({ toolId, expectedPlugins });
    }
    return { tools };
  }
}
