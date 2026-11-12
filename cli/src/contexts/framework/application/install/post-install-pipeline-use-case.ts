import type { ToolProfile } from "../../../tools/contract/tool-profile.js";
import { profileOf } from "../../../tools/contract/tool-profile-lookup.js";
import type { Manifest } from "../../domain/manifest.js";
import { aiddGitignoreEntries } from "../../domain/manifest-gitignore-entries.js";
import type { ManifestRepository } from "../../domain/ports/manifest-repository.js";
import type { GitignoreUseCase } from "../gitignore-use-case.js";

interface PostInstallPipelineOptions {
  projectRoot: string;
  manifest: Manifest;
  /** The profiles the installed tools are answered from. */
  tools: readonly ToolProfile[];
}

export class PostInstallPipelineUseCase {
  constructor(
    private readonly manifestRepo: ManifestRepository,
    private readonly gitignoreUseCase: GitignoreUseCase
  ) {}

  async execute(options: PostInstallPipelineOptions): Promise<void> {
    const { projectRoot, manifest, tools } = options;
    await this.manifestRepo.save(manifest);
    // One call for everything this CLI's own writes require ignored: the plugin cache and each
    // installed tool's machine-local file.
    await this.gitignoreUseCase.execute(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => {
        const profile = profileOf(tools, toolId);
        return profile.kind === "ai"
          ? (profile.marketplaceRegistration()?.machineLocalFiles() ?? [])
          : [];
      })
    );
  }
}
