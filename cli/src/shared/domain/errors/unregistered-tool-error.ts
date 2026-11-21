import { AiddError } from "./aidd-error.js";

export class UnregisteredToolError extends AiddError {
  readonly code = "unregistered-tool";
  constructor(toolId: string) {
    super(`Tool '${toolId}' is not registered.`);
    this.name = "UnregisteredToolError";
  }
}
