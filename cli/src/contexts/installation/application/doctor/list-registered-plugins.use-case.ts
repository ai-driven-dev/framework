import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ScopeRecords, ToolRecord } from "../../contract/records/scope-records.js";
import type { RegisteredPlugin, RegisteredPlugins } from "../../contract/registered-plugins.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import { requireManifest } from "../shared/require-manifest.js";
import type { InstallationScope } from "./installation-scope.js";

/** How the expected plugins read a host registration, the host registration's to answer, and
 * the scope's records, read through whoever keeps them. */
export interface RegisteredRefRecords extends Pick<ScopeRecords, "loadRecords"> {
  pluginRefsOf(record: ToolRecord | undefined): readonly string[];
  refOnHostName(plugin: string, hostName: string): string;
}

export interface ListRegisteredPluginsRequest extends Pick<InstallationScope, "allowedIds"> {
  readonly records: RegisteredRefRecords;
}

/**
 * The plugins each installed tool's host is expected to carry: the native registrations the
 * manifest recorded, falling back to the plugins it tracks, the state a `sync`-unaware installer
 * produced. Native registrations are already `<plugin>@<marketplace>` strings; the fallback
 * assembles the same shape.
 */
export class ListRegisteredPlugins {
  constructor(private readonly manifestRepo: Pick<ManifestRepository, "load">) {}

  async execute(command: ListRegisteredPluginsRequest): Promise<RegisteredPlugins> {
    const manifest = await requireManifest(this.manifestRepo);
    const registered = await command.records.loadRecords();
    const tools: { toolId: ToolId; expectedPlugins: readonly RegisteredPlugin[] }[] = [];
    for (const toolId of manifest.getInstalledToolIds()) {
      if (command.allowedIds && !command.allowedIds.has(toolId)) continue;
      const recorded = registered.get(toolId);
      const expectedPlugins =
        recorded !== undefined
          ? command.records.pluginRefsOf(recorded).map((ref) => ({ plugin: ref, ref }))
          : manifest.getRecordedPlugins(toolId).map(({ plugin, marketplace }) => ({
              plugin: plugin.name,
              // Limit: with no recorded registration the fallback assumes the alias equals the host name.
              ref:
                marketplace === undefined
                  ? undefined
                  : command.records.refOnHostName(plugin.name, marketplace),
            }));
      tools.push({ toolId, expectedPlugins });
    }
    return { tools };
  }
}
