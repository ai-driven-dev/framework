import { RemoveProjectPlugin } from "../../../src/contexts/installation/application/removal/remove-project-plugin.js";
import type { RemovalClaims } from "../../../src/contexts/installation/ports/removal-claims.js";
import type { FileReader } from "../../../src/shared/ports/file-reader.js";
import type { FileWriter } from "../../../src/shared/ports/file-writer.js";
import { projectIntegrationOver } from "./project-integration.builder.js";

/** A RemoveProjectPlugin over `fs`, with the project hooks and MCP steps composed for real. */
export function removeProjectPluginOf(
  fs: FileReader & FileWriter,
  claims?: RemovalClaims,
  homedir: () => string = () => "/home/dev"
): RemoveProjectPlugin {
  const { assertIntegration, removeIntegration } = projectIntegrationOver(fs);
  return new RemoveProjectPlugin({ fs, homedir, assertIntegration, removeIntegration, claims });
}

/** The composed steps a plugin removal takes the project integration out through. */
export function pickIntegration(fs: FileReader & FileWriter) {
  const { assertIntegration, removeIntegration } = projectIntegrationOver(fs);
  return { assert: assertIntegration, remove: removeIntegration };
}
