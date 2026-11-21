import { AiddError } from "./aidd-error.js";

export class AuthenticationError extends AiddError {
  readonly code = "authentication";
  constructor(source: string) {
    super(`Authentication failed (${source}). Run \`aidd auth login\` to authenticate.`);
    this.name = "AuthenticationError";
  }
}
