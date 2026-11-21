import { AiddError } from "./aidd-error.js";

export class InvalidInstallScopeError extends AiddError {
  readonly code = "invalid-install-scope";
  constructor(value: string) {
    super(`Invalid scope '${value}'. Expected 'project' or 'user'.`);
    this.name = "InvalidInstallScopeError";
  }
}
