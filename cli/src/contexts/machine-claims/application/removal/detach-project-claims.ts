import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { DetachNativePluginRefs } from "../ownership/detach-native-plugin-refs.use-case.js";
import type { DetachUserPlugin } from "../ownership/detach-user-plugin.use-case.js";

/** Releases a project's native-registration refs, then each user plugin, from the machine-level manifest. */
export function detachProjectClaims(
  detachNativePluginRefs: DetachNativePluginRefs,
  detachUserPlugin: DetachUserPlugin
) {
  return async (
    projectRoot: string,
    userPlugins: readonly { toolId: AiToolId; name: string }[],
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> => {
    await detachNativePluginRefs.execute({ projectRoot, refsByTool: nativeRefs });
    for (const { toolId, name } of userPlugins) {
      await detachUserPlugin.execute({ toolId, name, projectRoot });
    }
  };
}
