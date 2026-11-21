import { AiddError } from "./aidd-error.js";

export class ToolNotInManifestError extends AiddError {
  readonly code = "tool-not-in-manifest";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not installed in the manifest.`);
    this.name = "ToolNotInManifestError";
  }
}
