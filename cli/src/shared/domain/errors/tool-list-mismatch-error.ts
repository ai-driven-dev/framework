import { AiddError } from "./aidd-error.js";

export class ToolListMismatchError extends AiddError {
  readonly code = "tool-list-mismatch";
  constructor(toolIds: readonly string[]) {
    super(`Tool lists differ on: ${toolIds.join(", ")}.`);
    this.name = "ToolListMismatchError";
  }
}
