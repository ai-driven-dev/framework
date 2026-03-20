const DEFAULT_REPO = "ai-driven-dev/aidd-framework";

export class NoManifestError extends Error {
  constructor(repo = DEFAULT_REPO) {
    super(
      `No AIDD manifest found. Run \`aidd setup\` to initialize your project.\nRepository: ${repo}`
    );
    this.name = "NoManifestError";
  }
}

export class AiddFilesDetectedError extends Error {
  constructor(repo = DEFAULT_REPO) {
    super(
      `AIDD files detected but no manifest found.\nRun \`aidd setup\` to register existing files.\nRepository: ${repo}`
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
