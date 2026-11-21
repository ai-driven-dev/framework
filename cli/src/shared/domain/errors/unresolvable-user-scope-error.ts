import { AiddError } from "./aidd-error.js";

export class UnresolvableUserScopeError extends AiddError {
  readonly code = "unresolvable-user-scope";
  constructor(toolId: string) {
    super(
      `Manifest records a user-scope plugin for "${toolId}", but this tool's profile declares no user-scope plugins directory. Refusing to guess a base directory rather than silently resolving under the project root.`
    );
    this.name = "UnresolvableUserScopeError";
  }
}
