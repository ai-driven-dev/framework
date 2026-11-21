import { AiddError } from "./aidd-error.js";

export class HttpRedirectError extends AiddError {
  readonly code = "http-redirect";
  constructor(readonly url: string) {
    super(`HTTP redirect without location header from ${url}`);
    this.name = "HttpRedirectError";
  }
}
