import { AiddError } from "./aidd-error.js";

export class UserScopeUnavailableError extends AiddError {
  readonly code = "user-scope-unavailable";
  constructor() {
    super(
      "--scope user is not wired for this command yet — no user-scope manifest " +
        "repository was provided at construction."
    );
    this.name = "UserScopeUnavailableError";
  }
}
