import type { ConfirmRemoval } from "./confirm-removal.use-case.js";
import type { CleanPreview, PreviewProjectClean } from "./preview-project-clean.use-case.js";
import type { RemoveProjectInOrder } from "./remove-project-in-order.use-case.js";

export interface CleanProjectRequest {
  projectRoot: string;
  force: boolean;
  interactive?: boolean;
}

export interface CleanProjectResult {
  dryRun: boolean;
  manifestFound: boolean;
  preview: CleanPreview;
  fileCount: number;
}

export interface CleanProjectDeps {
  readonly preview: PreviewProjectClean;
  readonly confirm: ConfirmRemoval;
  readonly remove: RemoveProjectInOrder;
}

/**
 * `aidd clean`: removes what this project installed. The person confirms first, unless the run is
 * forced; without a confirmation it only reports what it would remove.
 */
export class CleanProject {
  constructor(private readonly deps: CleanProjectDeps) {}

  async execute(options: CleanProjectRequest): Promise<CleanProjectResult> {
    const { projectRoot, force, interactive } = options;
    const previewed = await this.deps.preview.execute({ projectRoot });
    if (previewed === null) {
      const emptyPreview: CleanPreview = { tools: [], totalFileCount: 0, nativeRegistrations: [] };
      return { dryRun: false, manifestFound: false, preview: emptyPreview, fileCount: 0 };
    }
    const { plan, preview } = previewed;
    const proceed = await this.deps.confirm.execute({
      force,
      interactive,
      question: "Remove all AIDD files?",
    });
    if (!proceed) return { dryRun: true, manifestFound: true, preview, fileCount: 0 };
    const fileCount = await this.deps.remove.execute({ plan, projectRoot, force });
    return { dryRun: false, manifestFound: true, preview, fileCount };
  }
}
