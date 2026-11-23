import { AiddError } from "../../../shared/domain/shared.error.js";

export class AuthStorageError extends AiddError {
  readonly code = "auth-storage";
  constructor(readonly detail: string) {
    super();
  }
}

export class GhCliError extends AiddError {
  readonly code = "gh-cli";
  constructor(readonly detail: string) {
    super();
  }
}
