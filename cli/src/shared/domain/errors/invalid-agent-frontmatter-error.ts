import { AiddError } from "./aidd-error.js";

export class InvalidAgentFrontmatterError extends AiddError {
  readonly code = "invalid-agent-frontmatter";
  constructor(agentName: string, detail: string) {
    super(`Agent '${agentName}' has invalid frontmatter: ${detail}.`);
    this.name = "InvalidAgentFrontmatterError";
  }
}
