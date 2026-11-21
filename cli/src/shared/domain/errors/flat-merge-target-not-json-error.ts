import { AiddError } from "./aidd-error.js";

export class FlatMergeTargetNotJsonError extends AiddError {
  readonly code = "flat-merge-target-not-json";
  constructor(shownPath: string, parseMessage: string) {
    super(`${shownPath} is not valid JSON (${parseMessage}); left untouched.`);
    this.name = "FlatMergeTargetNotJsonError";
  }
}
