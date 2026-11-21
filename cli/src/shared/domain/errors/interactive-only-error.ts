import { AiddError } from "./aidd-error.js";

export class InteractiveOnlyError extends AiddError {
  readonly code = "interactive-only";
  constructor(action: string) {
    super(`'${action}' requires an interactive terminal.`);
    this.name = "InteractiveOnlyError";
  }
}
