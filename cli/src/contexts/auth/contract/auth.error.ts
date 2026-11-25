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

/** A credential record cannot be had: `path` is the file to delete, `reason` why it is refused. */
export class CredentialRecordUnreadableError extends AiddError {
  readonly code = "credential-record-unreadable";
  constructor(
    readonly path: string,
    readonly reason: string
  ) {
    super();
  }
}
