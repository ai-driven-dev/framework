const DEFAULT_REPO = "ai-driven-dev/aidd-framework";

export class NoManifestError extends Error {
  constructor(repo = DEFAULT_REPO) {
    super(
      `No AIDD manifest found. If you have manually installed AIDD files, run:\n  aidd adopt --from <version> --tools <tool>\nCheck available tags for: ${repo}`
    );
    this.name = "NoManifestError";
  }
}

export class AiddFilesDetectedError extends Error {
  constructor(repo = DEFAULT_REPO) {
    super(
      `AIDD files detected but no manifest found.\nTo register existing files, run:\n  aidd adopt --from <version> --tools <tool>\nCheck available tags for: ${repo}`
    );
    this.name = "AiddFilesDetectedError";
  }
}

export class AdoptRequiresVersionError extends Error {
  constructor(repo = DEFAULT_REPO) {
    super(
      `--from <version|path> is required for adopt.\nExample: aidd adopt --from 3.6.0 --tools claude\nCheck available tags for: ${repo}`
    );
    this.name = "AdoptRequiresVersionError";
  }
}
