import { posix } from "node:path";
import type { ProjectHooksFormat } from "../../../tools/contract/tool-vocabulary.js";

/** A recorded script path is trusted only inside the plugin's own script directory, in normal form. */
export function assertScriptPath(script: {
  format: ProjectHooksFormat;
  toolName: string;
  pluginName: string;
  relativePath: string;
}): void {
  const { format, toolName, pluginName, relativePath } = script;
  const prefix = format.scriptDir(pluginName);
  if (
    !relativePath.startsWith(prefix) ||
    posix.isAbsolute(relativePath) ||
    relativePath.includes("\\") ||
    posix.normalize(relativePath) !== relativePath
  ) {
    throw new Error(
      `${toolName} hook script path '${relativePath}' has unproven provenance; detach refused.`
    );
  }
}
