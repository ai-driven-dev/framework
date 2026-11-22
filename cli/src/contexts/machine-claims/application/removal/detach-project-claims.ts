import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { MachineManifestRepository } from "../../ports/machine-manifest.js";
import { detachNativePluginRefs } from "../ownership/native-plugin-ownership.js";
import { detachUserPlugin } from "../ownership/user-plugin-ownership.js";

/** Releases a project's native-registration refs, then each user plugin, from the machine-level manifest. */
export function detachProjectClaims(
  userManifestRepo: (MachineManifestRepository & Lock) | undefined,
  fs: FileReader
) {
  return async (
    projectRoot: string,
    userPlugins: readonly { toolId: AiToolId; name: string }[],
    nativeRefs: ReadonlyMap<ToolId, readonly string[]>
  ): Promise<void> => {
    await detachNativePluginRefs({
      repo: userManifestRepo,
      fs,
      projectRoot,
      refsByTool: nativeRefs,
    });
    for (const { toolId, name } of userPlugins) {
      await detachUserPlugin({ repo: userManifestRepo, fs, toolId, name, projectRoot });
    }
  };
}
