import type { FileReader } from "../../../../../shared/ports/file-reader.js";
import type { FileWriter } from "../../../../../shared/ports/file-writer.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { ToolCatalog } from "../../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../../domain/manifest.js";
import { aiddGitignoreEntries } from "../../../domain/manifest-gitignore-entries.js";
import type { ManifestRepository } from "../../../ports/manifest-repository.js";
import type { UpdateGitignore } from "../../update-gitignore.use-case.js";
import { removeAiddState } from "./remove-aidd-state.js";

/** What RemoveAiddTraces is built from. */
export interface AiddTracesDeps {
  readonly fs: FileReader & FileWriter;
  readonly manifestRepo: ManifestRepository;
  readonly logger: Logger;
  readonly updateGitignore: UpdateGitignore;
}

/** What AIDD itself left in a project: its own state, then the gitignore lines the install added. */
export class RemoveAiddTraces {
  constructor(
    private readonly deps: AiddTracesDeps,
    private readonly tools: ToolCatalog
  ) {}

  async remove(manifest: Manifest, projectRoot: string): Promise<void> {
    const { fs, manifestRepo, logger, updateGitignore } = this.deps;
    await removeAiddState({ fs, manifestRepo, logger }, projectRoot);
    // Exactly what the pipeline added on install, never a subset of it.
    await updateGitignore.remove(
      projectRoot,
      aiddGitignoreEntries(manifest, (toolId) => this.tools.profile(toolId).machineLocalFiles())
    );
  }
}
