import { AiddError } from "./aidd-error.js";

export class ToolNotInstalledError extends AiddError {
  readonly code = "tool-not-installed";
  constructor(toolId: string, context?: string) {
    super(context ? `${context} '${toolId}' is not installed.` : `${toolId} is not installed`);
    this.name = "ToolNotInstalledError";
  }
}
