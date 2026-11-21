import { AiddError } from "./aidd-error.js";

export class FrameworkResolutionError extends AiddError {
  readonly code = "framework-resolution";
  constructor(message: string) {
    super(message);
    this.name = "FrameworkResolutionError";
  }
}
