import { AiddError } from "./aidd-error.js";

export class DuplicateToolIdError extends AiddError {
  readonly code = "duplicate-tool-id";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is registered twice.`);
    this.name = "DuplicateToolIdError";
  }
}
