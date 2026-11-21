import { AiddError } from "./aidd-error.js";

export class HttpError extends AiddError {
  readonly code = "http";
  constructor(
    readonly statusCode: number,
    readonly url: string
  ) {
    super(`Unexpected HTTP ${statusCode} from ${url}`);
    this.name = "HttpError";
  }
}
