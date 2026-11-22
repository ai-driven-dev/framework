import { FileHash } from "../../../shared/domain/file-hash.js";
import type { ProjectHookEntry, ProjectHooksFormat } from "../../tools/contract/tool-vocabulary.js";
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
