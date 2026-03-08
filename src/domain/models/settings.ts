const DEFAULT_REPO = "ai-driven-dev/aidd-framework";
export const DEFAULT_DOCS_DIR = "aidd_docs";

export class Settings {
  readonly repo: string;
  readonly docsDir: string;
  readonly verbose: boolean;

  constructor(params?: {
    repo?: string;
    docsDir?: string;
    verbose?: boolean;
  }) {
    this.repo = params?.repo ?? DEFAULT_REPO;
    this.docsDir = params?.docsDir ?? DEFAULT_DOCS_DIR;
    this.verbose = params?.verbose ?? false;
  }
}
