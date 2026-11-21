import type { AiToolId } from "../../../../shared/domain/tool.js";
import type { Manifest } from "../../domain/manifest.js";
import type { InstalledPlugin } from "../../domain/plugins/installed-plugin.js";

/** Each plugin installed on a tool other than `toolId`, once however many tools carry it. */
export function pluginsOnOtherTools(manifest: Manifest, toolId: AiToolId): InstalledPlugin[] {
  const seen = new Set<string>();
  const unique: InstalledPlugin[] = [];
  for (const id of manifest.getInstalledToolIds()) {
    if (id === toolId) continue;
    for (const plugin of manifest.getPlugins(id)) {
      if (seen.has(plugin.name)) continue;
      seen.add(plugin.name);
      unique.push(plugin);
    }
  }
  return unique;
}
