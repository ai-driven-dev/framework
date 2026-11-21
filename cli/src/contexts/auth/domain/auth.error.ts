import { AiddError } from "../../../shared/domain/shared.error.js";

export class AuthStorageError extends AiddError {
  readonly code = "auth-storage";
  constructor(message: string) {
    super(message);
    this.name = "AuthStorageError";
  }
}

export class GhCliError extends AiddError {
  readonly code = "gh-cli";
  constructor(message: string) {
    super(message);
    this.name = "GhCliError";
  }
}
