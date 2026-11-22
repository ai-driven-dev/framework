import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import type { ToolCatalog } from "../../../src/contexts/tools/contract/tool-catalog.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { removeProjectPluginOf } from "../../shared/testing/remove-project-plugin.builder.js";
import { KeepPrompter } from "../../shared/testing/scripted-prompter.fake.js";
import { projectMarketplaceRemover } from "./project-marketplace-remover.builder.js";

export const PROJECT_ROOT = "/test-project";

export function marketplaceNamed(name: string): Marketplace {
  return Marketplace.create({
    name,
    source: { kind: "github", repo: `owner/${name}` },
    scope: "project",
    addedAt: "2026-04-29T10:00:00.000Z",
  });
}

/** Records every path `deleteFile` is called with, so a test can prove where a plugin's
 * file actually got deleted from without inspecting private use-case state. */
class RecordingFileAdapter extends InMemoryFileAdapter {
  readonly deletedPaths: string[] = [];

  override async deleteFile(path: string): Promise<void> {
    this.deletedPaths.push(path);
    return super.deleteFile(path);
  }
}

export function buildUseCase(tools: ToolCatalog) {
  const fs = new RecordingFileAdapter({}, [PROJECT_ROOT]);
  const manifestRepo = new InMemoryManifestRepository();
  const registry = new InMemoryMarketplaceRegistry();
  const useCase = projectMarketplaceRemover(
    tools,
    removeProjectPluginOf(fs),
    manifestRepo,
    registry,
    new KeepPrompter()
  );
  return { useCase, registry, manifestRepo, fs };
}
