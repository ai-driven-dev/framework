import { AiddError } from "./aidd-error.js";

export class GhCliError extends AiddError {
  readonly code = "gh-cli";
  constructor(message: string) {
    super(message);
    this.name = "GhCliError";
  }
}
