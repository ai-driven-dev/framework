import { FileHash } from "../../../shared/domain/file-hash.js";
import type {
  ProjectHookEntry,
  ProjectHooksFormat,
  ProjectHooksLocation,
} from "../../tools/contract/tool-vocabulary.js";
import type { ProjectHooksProvenance } from "./plugins/plugin-entry.js";

/** Hash of one merged hook entry, independent of other plugins' entries. */
export function digestEntry(entry: ProjectHookEntry): string {
  return FileHash.of(JSON.stringify(entry)).value;
}

/** The entries a plugin contributed to a project hooks file, each with its digest. */
export function recordedProjectHookEntries(
  format: ProjectHooksFormat,
  content: string,
  pluginName: string
): ProjectHooksProvenance["entries"] {
  return format.contributedEntries(content, pluginName).map(({ event, entry }) => ({
    event,
    command: entry.command,
    digest: digestEntry(entry),
  }));
}

/** Whether a plugin's entries in the hooks file are no longer the ones its install recorded. */
export function projectHookEntriesEdited(
  recorded: ProjectHooksProvenance["entries"],
  current: ProjectHooksProvenance["entries"]
): boolean {
  const keyed = (entries: ProjectHooksProvenance["entries"]): string =>
    entries
      .map(({ event, command, digest }) => `${event}\u0000${command}\u0000${digest}`)
      .sort()
      .join("\n");
  return keyed(recorded) !== keyed(current);
}

/** The project hooks file a plugin's recorded entries are read back from: the one the tool
 * delivers to, else the one an earlier release delivered to. */
export function recordedHooksLocation(tool: {
  projectHooksDelivery(): ProjectHooksLocation | null;
  releasedProjectHooks(): ProjectHooksLocation | null;
}): ProjectHooksLocation | null {
  return tool.projectHooksDelivery() ?? tool.releasedProjectHooks();
}
