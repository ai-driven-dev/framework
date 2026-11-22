import type { ToolId } from "../../../../shared/domain/tool.js";
import type { RegisteredPlugin, RegisteredPlugins } from "../../contract/registered-plugins.js";
import type {
  RecordsBesideManifest,
  RegistrationRecordData,
} from "../../ports/record/registration-records.js";
import type { InstallationScope } from "./installation-scope.js";
import type { LoadManifest } from "./load-manifest.use-case.js";

/** How the expected plugins read a host registration: the host registration's to answer. */
export interface RegisteredRefRecords {
  pluginRefsOf(record: RegistrationRecordData | undefined): readonly string[];
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
  constructor(
    private readonly loadManifest: Pick<LoadManifest, "execute">,
    private readonly recordsRepo: Pick<RecordsBesideManifest, "loadRecords">
  ) {}

  async execute(command: ListRegisteredPluginsRequest): Promise<RegisteredPlugins> {
    const manifest = await this.loadManifest.execute();
    const registered = await this.recordsRepo.loadRecords();
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
