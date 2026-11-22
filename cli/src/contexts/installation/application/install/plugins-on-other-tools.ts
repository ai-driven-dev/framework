import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { RecordedPlugin } from "../../domain/plugins/recorded-plugin.js";

/** Each plugin installed on a tool other than `toolId`, once however many tools carry it. */
export function pluginsOnOtherTools(manifest: Manifest, toolId: AiToolId): RecordedPlugin[] {
  const seen = new Set<string>();
  const unique: RecordedPlugin[] = [];
  for (const id of manifest.getInstalledToolIds()) {
    if (id === toolId) continue;
    for (const recorded of manifest.getRecordedPlugins(id)) {
      if (seen.has(recorded.plugin.name)) continue;
      seen.add(recorded.plugin.name);
      unique.push(recorded);
    }
  }
  return unique;
}
