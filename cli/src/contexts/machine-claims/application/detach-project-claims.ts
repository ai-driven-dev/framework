import type { AiToolId, ToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import type { Lock } from "../../../shared/ports/lock.js";
import type { ManifestRepository } from "../../installation/ports/manifest-repository.js";
import { detachNativePluginRefs } from "./native-plugin-ownership.js";
import { detachUserPlugin } from "./user-plugin-ownership.js";

/** Releases a project's native-registration refs, then each user plugin, from the machine-level manifest. */
export function detachProjectClaims(
  userManifestRepo: (ManifestRepository & Lock) | undefined,
  fs: FileReader
) {
  return async (
    projectRoot: string,
    userPlugins: readonly { toolId: AiToolId; name: string }[],
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> => {
    await detachNativePluginRefs(userManifestRepo, fs, projectRoot, nativeRefs);
    for (const { toolId, name } of userPlugins) {
      await detachUserPlugin(userManifestRepo, fs, toolId, name, projectRoot);
    }
  };
}
