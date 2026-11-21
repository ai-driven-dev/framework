import { AiddError } from "./aidd-error.js";

export class InvalidMcpServerConfigError extends AiddError {
  readonly code = "invalid-mcp-server-config";
  constructor(name: string) {
    super(`MCP server "${name}" must have either a "command" or "url" field`);
    this.name = "InvalidMcpServerConfigError";
  }
}
