import { AiddError } from "./aidd-error.js";

export class ProjectScopeUnsupportedError extends AiddError {
  readonly code = "cursor-project-scope-unsupported";
  constructor() {
    super(
      "Cursor plugins only support user-scope install (~/.cursor/plugins/local/). Project-scope is not auto-loaded by Cursor."
    );
    this.name = "ProjectScopeUnsupportedError";
  }
}
