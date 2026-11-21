import { AiddError } from "./aidd-error.js";

export class UnknownAiToolIdError extends AiddError {
  readonly code = "unknown-ai-tool-id";
  constructor(tool: string, validIds: readonly string[]) {
    super(`Unknown AI tool: ${tool}. Valid AI tools: ${validIds.join(", ")}`);
    this.name = "UnknownAiToolIdError";
  }
}
