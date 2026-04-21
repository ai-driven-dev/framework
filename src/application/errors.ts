import { Manifest } from "../domain/models/manifest.js";
import type { ToolCategory } from "../domain/models/tool-config.js";

export { NoFrameworkSourceError } from "../domain/errors.js";

export class NoManifestError extends Error {
  constructor(repo = Manifest.DEFAULT_REPO) {
    super(
      `No AIDD manifest found. Run \`aidd setup\` to initialize your project.\nRepository: ${repo}`
    );
    this.name = "NoManifestError";
  }
}

export class AiddFilesDetectedError extends Error {
  constructor(repo = Manifest.DEFAULT_REPO) {
    super(
      `AIDD files detected but no manifest found.\nRun \`aidd setup\` to register existing files.\nRepository: ${repo}`
    );
    this.name = "AiddFilesDetectedError";
  }
}

export class AdoptRequiresVersionError extends Error {
  constructor(repo = Manifest.DEFAULT_REPO, diagnostic = "") {
    const suffix = diagnostic ? `\n\n${diagnostic}` : "";
    super(
      `--from <version|path> is required for adopt.\nExample: aidd setup --ai claude --from 3.6.0\nCheck available tags for: ${repo}${suffix}`
    );
    this.name = "AdoptRequiresVersionError";
  }
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated. Run `aidd auth login`.");
    this.name = "NotAuthenticatedError";
  }
}

export class AlreadyInitializedError extends Error {
  constructor(message = "Already initialized. Use `aidd update` to upgrade.") {
    super(message);
    this.name = "AlreadyInitializedError";
  }
}

export class InputRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputRequiredError";
  }
}

export class ToolNotInstalledError extends Error {
  constructor(toolId: string, context?: string) {
    super(context ? `${context} '${toolId}' is not installed.` : `${toolId} is not installed`);
    this.name = "ToolNotInstalledError";
  }
}

export class NoToolsInstalledError extends Error {
  constructor(category?: ToolCategory) {
    super(category ? `No ${category.toUpperCase()} tools installed.` : "No tools installed.");
    this.name = "NoToolsInstalledError";
  }
}
