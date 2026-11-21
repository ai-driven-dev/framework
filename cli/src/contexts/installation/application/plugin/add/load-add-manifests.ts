import type { ToolIdResolver } from "../../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import { Manifest } from "../../../domain/manifest.js";
import type { ManifestRepository } from "../../../ports/manifest-repository.js";
import { requireManifest } from "../../shared/require-manifest.js";

/** The project manifest an add edits, and the machine's, empty when nothing is claimed yet. */
export async function loadAddManifests(
  manifests: { project: ManifestRepository; user: ManifestRepository },
  tools: ToolCatalog
): Promise<{ manifest: Manifest; machine: Manifest }> {
  const resolveToolId: ToolIdResolver = (raw) => tools.toolId(raw);
  const manifest = Manifest.fromJSON(
    (await requireManifest(manifests.project)).toJSON(),
    resolveToolId
  );
  const existingMachine = await manifests.user.load();
  const machine =
    existingMachine === null
      ? Manifest.create()
      : Manifest.fromJSON(existingMachine.toJSON(), resolveToolId);
  return { manifest, machine };
}
