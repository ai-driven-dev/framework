import { AiddError } from "./aidd-error.js";

export class JsonParseError extends AiddError {
  readonly code = "json-parse";
  constructor(path: string, cause: string) {
    super(`Cannot parse existing JSON at ${path}: ${cause}`);
    this.name = "JsonParseError";
  }
}
