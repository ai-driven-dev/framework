import { AiddError } from "./aidd-error.js";

export class AuthStorageError extends AiddError {
  readonly code = "auth-storage";
  constructor(message: string) {
    super(message);
    this.name = "AuthStorageError";
  }
}
