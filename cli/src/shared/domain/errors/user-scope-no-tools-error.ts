import { AiddError } from "./aidd-error.js";

export class UserScopeNoToolsError extends AiddError {
  readonly code = "user-scope-no-tools";
  constructor() {
    super(
      "--global with no --ide registers the shared source for no tool at all. Pass " +
        "`--ide <ids>` naming which tool to activate machine-wide."
    );
    this.name = "UserScopeNoToolsError";
  }
}
