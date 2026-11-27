import { AiddError } from "../shared/domain/shared.error.js";

export class UnknownToolError extends AiddError {
  readonly code = "unknown-tool";
  constructor(
    readonly raw: string,
    readonly validIds: readonly string[]
  ) {
    super();
  }
}

export class RecipeValidationFailedError extends AiddError {
  readonly code = "recipe-validation-failed";
  constructor(readonly report: string) {
    super();
  }
}
