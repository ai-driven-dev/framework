import type { AiToolId, ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { Lock } from "../../../../shared/ports/lock.js";
import type { MachineManifestRepository } from "../../ports/machine-manifest.js";
import { detachNativePluginRefs } from "../ownership/native-plugin-ownership.js";
import { detachUserPlugin } from "../ownership/user-plugin-ownership.js";

/** The claims a plugin removal releases, bound to the machine manifest it releases them from. */
export function removalClaims(
  repo: (MachineManifestRepository & Lock) | undefined,
  fs: FileReader
) {
  return {
    detachNativeRefs: (projectRoot: string, refsByTool: ReadonlyMap<ToolId, readonly string[]>) =>
      detachNativePluginRefs({ repo, fs, projectRoot, refsByTool }),
    detachUserPlugin: (toolId: AiToolId, name: string, projectRoot: string) =>
      detachUserPlugin({ repo, fs, toolId, name, projectRoot }),
  };
}
