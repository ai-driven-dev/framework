import { AiddError } from "./aidd-error.js";

export class InputRequiredError extends AiddError {
  readonly code = "input-required";
  constructor(message: string) {
    super(message);
    this.name = "InputRequiredError";
  }
}
