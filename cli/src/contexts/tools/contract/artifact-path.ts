import {
  flatAgentFilePath,
  flatSkillPath,
} from "../../../shared/domain/materialization/flat-paths.js";
import type { SupportedArtifact } from "./build-contract.js";

/** Where a plugin file lands in an artifact: from its layout when it declares one, else from its
 * own path rule. A layout places the artifact its source reads from `agents/`, else a skill. */
export function artifactPath(artifact: SupportedArtifact, plugin: string, relPath: string): string {
  const { layout, path, source } = artifact;
  if (layout !== undefined) {
    const place =
      "srcDir" in source && source.srcDir === "agents" ? flatAgentFilePath : flatSkillPath;
    return place(layout, plugin, relPath);
  }
  if (path === undefined) throw new Error("artifact declares no placement");
  return path(plugin, relPath);
}
