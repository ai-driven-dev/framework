import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { DetachNativePluginRefs } from "../ownership/detach-native-plugin-refs.use-case.js";
import type { DetachUserPlugin } from "../ownership/detach-user-plugin.use-case.js";

/** The claims a plugin removal releases, through the two use cases that release them. */
export function removalClaims(
  detachNativePluginRefs: DetachNativePluginRefs,
  detachUserPlugin: DetachUserPlugin
) {
  return {
    detachNativeRefs: (projectRoot: string, refsByTool: ReadonlyMap<ToolId, readonly string[]>) =>
      detachNativePluginRefs.execute({ projectRoot, refsByTool }),
    detachUserPlugin: (toolId: AiToolId, name: string, projectRoot: string) =>
      detachUserPlugin.execute({ toolId, name, projectRoot }),
  };
}
