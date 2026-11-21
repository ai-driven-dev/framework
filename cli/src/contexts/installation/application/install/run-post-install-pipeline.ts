import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import { aiddGitignoreEntries } from "../../domain/manifest-gitignore-entries.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { UpdateGitignore } from "../update-gitignore.js";

interface RunPostInstallPipelineCommand {
  projectRoot: string;
  manifest: Manifest;
}

export class RunPostInstallPipeline {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly updateGitignore: UpdateGitignore,
    /** The profiles the installed tools are answered from. */
    private readonly tools: ToolCatalog
  ) {}

  async execute(options: RunPostInstallPipelineCommand): Promise<void> {
    const { projectRoot, manifest } = options;
    await this.manifestRepo.save(manifest);
    // One call for everything this CLI's own writes require ignored: the plugin cache and each
    // installed tool's machine-local file.
    await this.updateGitignore.execute(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => this.tools.profile(toolId).machineLocalFiles())
    );
  }
}
