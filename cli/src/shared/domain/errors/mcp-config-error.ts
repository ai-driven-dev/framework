import { AiddError } from "./aidd-error.js";

export class McpConfigError extends AiddError {
  readonly code = "mcp-config";
  constructor(message: string) {
    super(message);
    this.name = "McpConfigError";
  }
}
