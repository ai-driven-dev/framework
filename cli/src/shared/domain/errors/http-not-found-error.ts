import { AiddError } from "./aidd-error.js";

export class HttpNotFoundError extends AiddError {
  readonly code = "http-not-found";
  constructor(readonly url: string) {
    super(`Resource not found (HTTP 404): ${url}`);
    this.name = "HttpNotFoundError";
  }
}
