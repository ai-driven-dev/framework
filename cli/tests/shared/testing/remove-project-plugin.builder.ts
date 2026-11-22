import { projectIntegrationOf } from "../../../src/composition/installation.js";
import {
  type RemovalClaims,
  RemoveProjectPlugin,
} from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";

/** A RemoveProjectPlugin over `fs`, with the project hooks and MCP steps composed for real. */
export function removeProjectPluginOf(
  fs: FileReader & FileWriter,
  claims?: RemovalClaims,
  homedir: () => string = () => "/home/dev"
): RemoveProjectPlugin {
  const { assertIntegration, removeIntegration } = projectIntegrationOf(fs);
  return new RemoveProjectPlugin({ fs, homedir, assertIntegration, removeIntegration, claims });
}

/** The composed steps a plugin removal takes the project integration out through. */
export function pickIntegration(fs: FileReader & FileWriter) {
  const { assertIntegration, removeIntegration } = projectIntegrationOf(fs);
  return { assert: assertIntegration, remove: removeIntegration };
}
